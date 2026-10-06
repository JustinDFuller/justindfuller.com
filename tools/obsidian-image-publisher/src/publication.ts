import { createHash } from "node:crypto";
import {
  validateImage,
  parseManifest,
  maximumImageBytes,
  type PublishedImage,
} from "./manifest.ts";
import {
  SdkS3Transport,
  verifyMetadata,
  type S3Transport,
  type S3Target,
} from "./s3.ts";

export const publicImageCache = "public, max-age=31536000, immutable";
const privateJSONLimit = 64 * 1024 * 1024;
const fingerprint = (bytes: Uint8Array, algorithm = "sha256") =>
  createHash(algorithm).update(bytes).digest("hex");

export function r2Target(account: string, bucket: string): S3Target {
  if (
    !/^[a-f0-9]{32}$/.test(account) ||
    !/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)
  )
    throw new Error("Explicit Cloudflare R2 destination required");
  return {
    id: bucket,
    bucket,
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
  };
}

export function environmentTransport(prefix: string): SdkS3Transport {
  if (
    ![
      "OBSIDIAN_SOURCE",
      "OBSIDIAN_MEDIA",
      "OBSIDIAN_STATE",
      "OBSIDIAN_REPORT",
    ].includes(prefix)
  )
    throw new Error("Invalid credential purpose");
  const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`];
  const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`];
  if (!accessKeyId || !secretAccessKey)
    throw new Error("Separate R2 credentials required");
  return new SdkS3Transport({ accessKeyId, secretAccessKey });
}

export class PrivateR2Store {
  readonly transport: S3Transport;
  readonly target: S3Target;
  readonly counters = {
    heads: 0,
    gets: 0,
    puts: 0,
    bytesRead: 0,
    bytesWritten: 0,
  };

  constructor(transport: S3Transport, target: S3Target) {
    if (target.bucket !== "justindfuller-obsidian-state")
      throw new Error("Private state storage requires its dedicated bucket");
    this.transport = transport;
    this.target = target;
  }

  private validate(key: string): void {
    if (
      !/^(accepted|journals|candidates|reports|receipts|rollback|artifacts)\/[a-zA-Z0-9/_.-]+$/.test(
        key,
      ) ||
      key.split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Invalid private state object key");
  }

  async get(
    key: string,
    limit = privateJSONLimit,
  ): Promise<Uint8Array | undefined> {
    this.validate(key);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256 * 1024 * 1024)
      throw new Error("Invalid private object read limit");
    this.counters.heads++;
    const head = await this.transport.head(this.target, key);
    if (!head) return undefined;
    if (
      !Number.isSafeInteger(head.contentLength) ||
      !head.contentLength ||
      head.contentLength > limit ||
      !/^[a-f0-9]{64}$/.test(head.metadata?.sha256 ?? "") ||
      !/^[a-f0-9]{32}$/.test(head.metadata?.md5 ?? "")
    )
      throw new Error("Private object metadata invalid");
    this.counters.gets++;
    const bytes = await this.transport.get(this.target, key, limit);
    if (
      !bytes ||
      bytes.byteLength !== head.contentLength ||
      fingerprint(bytes) !== head.metadata?.sha256 ||
      fingerprint(bytes, "md5") !== head.metadata?.md5
    )
      throw new Error("Private object read integrity failure");
    this.counters.bytesRead += bytes.byteLength;
    return bytes;
  }

  async put(key: string, bytes: Uint8Array, immutable = false): Promise<void> {
    this.validate(key);
    if (!bytes.byteLength || bytes.byteLength > 256 * 1024 * 1024)
      throw new Error("Private object write exceeds limit");
    const sha256 = fingerprint(bytes),
      md5 = fingerprint(bytes, "md5");
    this.counters.puts++;
    await this.transport.put(this.target, {
      bucket: this.target.bucket,
      key,
      bytes,
      contentType: key.endsWith(".json")
        ? "application/json"
        : "application/octet-stream",
      sha256,
      md5,
      md5Base64: Buffer.from(md5, "hex").toString("base64"),
      immutable,
      cacheControl: "private, no-store",
    });
    this.counters.heads++;
    const head = await this.transport.head(this.target, key);
    if (
      !head ||
      head.contentLength !== bytes.byteLength ||
      head.metadata?.sha256 !== sha256 ||
      head.metadata?.md5 !== md5 ||
      !/\bno-store\b/.test(head.cacheControl ?? "")
    )
      throw new Error("Private object write unverified");
    this.counters.bytesWritten += bytes.byteLength;
  }

  async listArchives(namespace: string) {
    if (!(this.transport instanceof SdkS3Transport))
      throw new Error("Archive maintenance transport unavailable");
    return this.transport.listArchives(this.target, namespace);
  }

  async deleteArchive(key: string): Promise<void> {
    if (!(this.transport instanceof SdkS3Transport))
      throw new Error("Archive maintenance transport unavailable");
    await this.transport.deleteArchive(this.target, key);
  }
}

export async function promoteProductionImages(
  prepared: {
    version: number;
    mode: string;
    images: Record<string, PublishedImage>;
  },
  source: { transport: S3Transport; target: S3Target },
  media: { transport: S3Transport; target: S3Target },
): Promise<{
  verified: string[];
  unavailable: string[];
  copied: number;
  bytes: number;
}> {
  if (
    prepared.version !== 1 ||
    prepared.mode !== "production" ||
    !prepared.images ||
    source.target.bucket !== "justindfuller-obsidian-source" ||
    media.target.bucket !== "justindfuller-obsidian-media" ||
    source.target.endpoint !== media.target.endpoint
  )
    throw new Error(
      "Production preparation and separate source/media destinations required",
    );
  const records = Object.entries(prepared.images).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (records.length > 10000)
    throw new Error("Image promotion metadata exceeds limit");
  parseManifest(
    JSON.stringify({
      version: 1,
      images: Object.fromEntries(
        records.map(([key, record]) => {
          if (key !== record.key)
            throw new Error("Image promotion key mismatch");
          return [`image/${key.slice(3)}`, record];
        }),
      ),
    }),
  );
  const result = {
    verified: [] as string[],
    unavailable: [] as string[],
    copied: 0,
    bytes: 0,
  };
  for (const [key, record] of records) {
    try {
      const existing = await media.transport.head(media.target, key);
      if (existing) {
        verifyMetadata(existing, record);
        if (existing.cacheControl !== publicImageCache)
          throw new Error("Public image caching differs");
      } else {
        const head = await source.transport.head(source.target, key);
        if (!head) throw new Error("Private original unavailable");
        verifyMetadata(head, record);
        const bytes = await source.transport.get(
          source.target,
          key,
          maximumImageBytes,
        );
        if (!bytes) throw new Error("Private original unavailable");
        const validated = validateImage(`Blog/image/${key.slice(3)}`, bytes);
        if (
          validated.sha256 !== record.sha256 ||
          validated.md5 !== record.md5 ||
          validated.size !== record.size ||
          validated.contentType !== record.contentType
        )
          throw new Error("Private image byte verification failed");
        try {
          await media.transport.put(media.target, {
            bucket: media.target.bucket,
            key,
            bytes,
            contentType: record.contentType,
            sha256: record.sha256,
            md5: record.md5,
            md5Base64: Buffer.from(record.md5, "hex").toString("base64"),
            immutable: true,
            cacheControl: publicImageCache,
          });
        } catch (error) {
          if (
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode !== 412
          )
            throw error;
        }
        const destination = await media.transport.head(media.target, key);
        if (!destination) throw new Error("Public destination unavailable");
        verifyMetadata(destination, record);
        if (destination.cacheControl !== publicImageCache)
          throw new Error("Public image caching differs");
        result.copied++;
        result.bytes += record.size;
      }
      result.verified.push(key);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 401 || status === 403)
        throw new Error("Image promotion credentials lack required authority");
      result.unavailable.push(key);
    }
  }
  return result;
}
