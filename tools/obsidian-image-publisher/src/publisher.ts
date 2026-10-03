import { createHash } from "node:crypto";
import {
  emptyManifest,
  imageRoot,
  manifestPath,
  maximumImageBytes,
  parseManifest,
  serializeManifest,
  validateImage,
  type AssetManifest,
  type ValidatedImage,
} from "./manifest.ts";
import { verifyManifestObject, verifyOrUpload, type S3Target, type S3Transport } from "./s3.ts";

export type VaultImage = {
  path: string;
  size: number;
  mtime: number;
};

export interface ImageVault {
  listImages(): VaultImage[];
  readBinary(path: string): Promise<ArrayBuffer>;
  readText(path: string): Promise<string | undefined>;
  writeText(path: string, value: string): Promise<void>;
}

export type PublishResult = {
  uploaded: string[];
  unchanged: string[];
  failed: Array<{ path: string; message: string }>;
};

export type PublisherOptions = {
  vault: ImageVault;
  targets: S3Target[];
  transport: S3Transport;
  maximumBytes?: number;
  notify?: (message: string) => void;
};

export class ImagePublisher {
  private options: PublisherOptions;
  private manifest: AssetManifest = emptyManifest();
  private running: Promise<PublishResult> | undefined;
  private rerunRequested = false;
  private readonly statCache = new Map<string, string>();

  constructor(options: PublisherOptions) {
    this.options = options;
  }

  updateConnection(targets: S3Target[], transport: S3Transport): void {
    this.options = { ...this.options, targets, transport };
  }

  async reconcile(): Promise<PublishResult> {
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = this.runLoop();
    try {
      return await this.running;
    } finally {
      this.running = undefined;
    }
  }

  private async runLoop(): Promise<PublishResult> {
    let result: PublishResult = { uploaded: [], unchanged: [], failed: [] };
    do {
      this.rerunRequested = false;
      result = await this.runReconcile();
    } while (this.rerunRequested);
    return result;
  }

  getManifest(): AssetManifest {
    return structuredClone(this.manifest);
  }

  invalidate(path: string): void {
    this.statCache.delete(path);
  }

  private async runReconcile(): Promise<PublishResult> {
    const result: PublishResult = { uploaded: [], unchanged: [], failed: [] };
    if (!this.options.targets.length) {
      result.failed.push({ path: "Blog/image", message: "Add at least one S3 destination in plugin settings" });
      this.notifyResult(result);
      return result;
    }
    await this.loadManifest();
    const files = this.options.vault.listImages().filter((file) => file.path.startsWith(imageRoot)).sort((a, b) => a.path.localeCompare(b.path));
    for (const file of files) {
      try {
        if (file.size > (this.options.maximumBytes ?? maximumImageBytes)) throw new Error(`File exceeds ${this.options.maximumBytes ?? maximumImageBytes} byte limit`);
        const path = file.path.slice("Blog/".length);
        const currentRecord = this.manifest.images[path];
        const stat = `${file.size}:${file.mtime}`;
        const cacheIdentity = currentRecord ? `${stat}:${currentRecord.sha256}:${currentRecord.key}` : undefined;
        if (currentRecord && this.statCache.get(file.path) === cacheIdentity) {
          let verified = true;
          for (const target of this.options.targets) {
            if (!(await verifyManifestObject(this.options.transport, target, currentRecord.key, currentRecord))) verified = false;
          }
          if (verified) {
            result.unchanged.push(file.path);
            continue;
          }
        }
        const bytes = new Uint8Array(await this.options.vault.readBinary(file.path));
        const image = validateImage(file.path, bytes, this.options.maximumBytes ?? maximumImageBytes);
        const current = this.isCurrent(image);
        const md5Base64 = createHash("md5").update(image.bytes).digest("base64");
        let uploaded = false;
        for (const target of this.options.targets) {
          const outcome = await verifyOrUpload(this.options.transport, target, image, md5Base64);
          uploaded ||= outcome.uploaded;
        }
        if (current && !uploaded) {
          this.statCache.set(file.path, cacheIdentity as string);
          result.unchanged.push(file.path);
          continue;
        }
        const record = {
          sha256: image.sha256,
          md5: image.md5,
          size: image.size,
          contentType: image.contentType,
          key: image.key,
        };
        await this.commitManifestRecord(image.path, record);
        this.statCache.set(file.path, `${stat}:${record.sha256}:${record.key}`);
        if (uploaded) result.uploaded.push(file.path);
        else result.unchanged.push(file.path);
      } catch (error) {
        result.failed.push({ path: file.path, message: safeMessage(error) });
      }
    }
    this.notifyResult(result);
    return result;
  }

  private async loadManifest(): Promise<void> {
    const text = await this.options.vault.readText(manifestPath);
    this.manifest = text === undefined ? emptyManifest() : parseManifest(text);
  }

  private async commitManifestRecord(path: string, record: AssetManifest["images"][string]): Promise<void> {
    const text = await this.options.vault.readText(manifestPath);
    const current = text === undefined ? emptyManifest() : parseManifest(text);
    current.images[path] = record;
    await this.options.vault.writeText(manifestPath, serializeManifest(current));
    this.manifest = current;
  }

  private isCurrent(image: ValidatedImage): boolean {
    const current = this.manifest.images[image.path];
    return Boolean(
      current &&
      current.sha256 === image.sha256 &&
      current.md5 === image.md5 &&
      current.size === image.size &&
      current.contentType === image.contentType &&
      current.key === image.key,
    );
  }

  private notifyResult(result: PublishResult): void {
    const parts = [`${result.uploaded.length} uploaded`, `${result.unchanged.length} unchanged`, `${result.failed.length} failed`];
    const failures = result.failed.slice(0, 3).map((failure) => `${failure.path}: ${failure.message}`);
    this.options.notify?.([parts.join(", "), ...failures].join("\n"));
  }
}

function safeMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}
