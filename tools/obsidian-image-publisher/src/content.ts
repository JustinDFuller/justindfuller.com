import { createHash } from "node:crypto";
import { validateImage, type PublishedImage } from "./manifest.ts";
import { verifyMetadata, type S3Target, type S3Transport } from "./s3.ts";

export type FileRecord = { key: string; sha256: string; size: number };
export type SourceSnapshot = {
  version: 1;
  files: Record<string, FileRecord>;
  images: Record<string, PublishedImage>;
};
export type PublishingIssue = { path: string; category: string };
export type PublishResult = {
  revision: string;
  snapshot: SourceSnapshot;
  uploaded: number;
  activated: boolean;
  issues: PublishingIssue[];
};
export interface VaultSource {
  paths(): Promise<string[]>;
  read(path: string): Promise<Uint8Array>;
}

export const maximumSnapshotBytes = 8 * 1024 * 1024;
export function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalSnapshot(snapshot: SourceSnapshot): Uint8Array {
  const sorted = <T>(values: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(values).sort(([a], [b]) =>
        Buffer.compare(Buffer.from(a), Buffer.from(b)),
      ),
    );
  const value = JSON.stringify({
    version: 1,
    files: sorted(snapshot.files),
    images: sorted(snapshot.images),
  })
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const bytes = Buffer.from(value);
  if (
    bytes.byteLength > maximumSnapshotBytes ||
    Object.keys(snapshot.images).length > 10000 ||
    Buffer.byteLength(JSON.stringify(snapshot.images)) > 2 * 1024 * 1024
  )
    throw new Error("Source control document exceeds protocol limits");
  return bytes;
}

function safePath(path: string): boolean {
  return (
    !path.includes("\\") &&
    !/[\x00\r\n]/.test(path) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

async function immutableObject(
  transport: S3Transport,
  target: S3Target,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const sha256 = hash(bytes),
    md5 = createHash("md5").update(bytes).digest("hex");
  const expected = { key, size: bytes.byteLength, contentType, sha256, md5 };
  const existing = await transport.head(target, key);
  if (existing) {
    verifyMetadata(existing, expected);
    return false;
  }
  try {
    await transport.put(target, {
      bucket: target.bucket,
      key,
      bytes,
      contentType,
      sha256,
      md5,
      md5Base64: Buffer.from(md5, "hex").toString("base64"),
    });
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 412 &&
      (error as { name?: string }).name !== "PreconditionFailed"
    )
      throw error;
  }
  const actual = await transport.head(target, key);
  if (!actual) throw new Error("Immutable source object missing after upload");
  verifyMetadata(actual, expected);
  return true;
}

export async function publishSnapshot(
  vault: VaultSource,
  transport: S3Transport,
  target: S3Target,
  previous?: PublishResult,
): Promise<PublishResult> {
  const paths = await vault.paths();
  if (new Set(paths).size !== paths.length)
    throw new Error("Vault scan contains duplicate paths");
  const snapshot: SourceSnapshot = { version: 1, files: {}, images: {} };
  const issues: PublishingIssue[] = [];
  let uploaded = 0;
  for (const path of paths.sort()) {
    if (!path.startsWith("Blog/")) continue;
    const logical = path.slice(5);
    if (!safePath(logical)) throw new Error("Vault scan contains unsafe paths");
    if (!logical.includes("/") && logical.endsWith(".md")) {
      const bytes = await vault.read(path);
      const sha256 = hash(bytes),
        key = `markdown/v1/${sha256}.md`;
      if (
        await immutableObject(
          transport,
          target,
          key,
          bytes,
          "text/markdown; charset=utf-8",
        )
      )
        uploaded++;
      snapshot.files[logical] = { key, sha256, size: bytes.byteLength };
    } else if (
      logical.startsWith("image/") &&
      /\.(jpg|png|svg)$/.test(logical)
    ) {
      const bytes = await vault.read(path);
      let record: PublishedImage;
      try {
        const validated = validateImage(path, bytes);
        const { sha256, md5, size, contentType, key } = validated;
        record = { sha256, md5, size, contentType, key };
      } catch {
        issues.push({ path: logical, category: "image_validation" });
        const prior = previous?.snapshot.images[logical];
        if (prior) {
          const metadata = await transport.head(target, prior.key);
          if (!metadata) throw new Error("Previous image is unavailable");
          verifyMetadata(metadata, prior);
          snapshot.images[logical] = prior;
        }
        continue;
      }
      if (
        await immutableObject(
          transport,
          target,
          record.key,
          bytes,
          record.contentType,
        )
      )
        uploaded++;
      snapshot.images[logical] = record;
    } else if (logical !== "asset-manifest.json")
      issues.push({ path: logical, category: "unsupported_source" });
  }
  const bytes = canonicalSnapshot(snapshot),
    revision = hash(bytes);
  if (previous?.revision === revision)
    return { revision, snapshot, uploaded, activated: false, issues };
  if (
    await immutableObject(
      transport,
      target,
      `snapshots/${revision}.json`,
      bytes,
      "application/json",
    )
  )
    uploaded++;
  const pointer = Buffer.from(JSON.stringify({ version: 1, revision }));
  const sha256 = hash(pointer),
    md5 = createHash("md5").update(pointer).digest("hex");
  await transport.put(target, {
    bucket: target.bucket,
    key: "latest.json",
    bytes: pointer,
    contentType: "application/json",
    sha256,
    md5,
    md5Base64: Buffer.from(md5, "hex").toString("base64"),
    immutable: false,
  });
  const active = await transport.get(target, "latest.json", 1024);
  if (!active || Buffer.compare(Buffer.from(active), pointer) !== 0)
    throw new Error("Source activation is unverified");
  return { revision, snapshot, uploaded, activated: true, issues };
}
