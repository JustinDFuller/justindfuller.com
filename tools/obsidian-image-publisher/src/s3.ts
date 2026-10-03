import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { PublishedImage, ValidatedImage } from "./manifest.ts";

export type S3Target = {
  id: string;
  bucket: string;
  region: string;
};

export type ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type ObjectPut = {
  bucket: string;
  key: string;
  bytes: Uint8Array;
  contentType: string;
  md5Base64: string;
  sha256: string;
  md5: string;
};

export interface S3Transport {
  head(target: S3Target, key: string): Promise<ObjectMetadata | undefined>;
  put(target: S3Target, object: ObjectPut): Promise<void>;
}

export class SdkS3Transport implements S3Transport {
  private readonly clients = new Map<string, S3Client>();
  private readonly credentials: { accessKeyId: string; secretAccessKey: string };

  constructor(credentials: { accessKeyId: string; secretAccessKey: string }) {
    this.credentials = credentials;
  }

  async head(target: S3Target, key: string): Promise<ObjectMetadata | undefined> {
    try {
      const response = await this.client(target.region).send(new HeadObjectCommand({ Bucket: target.bucket, Key: key }));
      return metadataFromHead(response);
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async put(target: S3Target, object: ObjectPut): Promise<void> {
    await this.client(target.region).send(
      new PutObjectCommand({
        Bucket: target.bucket,
        Key: object.key,
        Body: object.bytes,
        ContentType: object.contentType,
        ContentMD5: object.md5Base64,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { sha256: object.sha256, md5: object.md5 },
        IfNoneMatch: "*",
      }),
    );
  }

  close(): void {
    for (const client of this.clients.values()) client.destroy();
    this.clients.clear();
  }

  private client(region: string): S3Client {
    let client = this.clients.get(region);
    if (!client) {
      client = new S3Client({
        region,
        credentials: this.credentials,
        maxAttempts: 3,
      });
      this.clients.set(region, client);
    }
    return client;
  }
}

export async function verifyOrUpload(
  transport: S3Transport,
  target: S3Target,
  image: ValidatedImage,
  md5Base64: string,
): Promise<{ record: PublishedImage; uploaded: boolean }> {
  const existing = await transport.head(target, image.key);
  if (existing) {
    verifyMetadata(existing, image);
    return { record: manifestRecord(image), uploaded: false };
  }
  try {
    await transport.put(target, {
      bucket: target.bucket,
      key: image.key,
      bytes: image.bytes,
      contentType: image.contentType,
      md5Base64,
      sha256: image.sha256,
      md5: image.md5,
    });
  } catch (error) {
    if (!isPreconditionFailed(error)) throw error;
  }
  const verified = await transport.head(target, image.key);
  if (!verified) throw new Error(`Uploaded object could not be verified in ${target.id}`);
  verifyMetadata(verified, image);
  return { record: manifestRecord(image), uploaded: true };
}

export async function verifyManifestObject(
  transport: S3Transport,
  target: S3Target,
  key: string,
  expected: PublishedImage,
): Promise<boolean> {
  const actual = await transport.head(target, key);
  if (!actual) return false;
  verifyMetadata(actual, {
    key,
    size: expected.size,
    contentType: expected.contentType,
    sha256: expected.sha256,
    md5: expected.md5,
  });
  return true;
}

export function metadataFromHead(output: HeadObjectCommandOutput): ObjectMetadata {
  return {
    contentLength: output.ContentLength,
    contentType: output.ContentType,
    metadata: output.Metadata,
  };
}

export function verifyMetadata(
  actual: ObjectMetadata,
  expected: Pick<ValidatedImage, "key" | "size" | "contentType" | "sha256" | "md5">,
): void {
  if (
    actual.contentLength !== expected.size ||
    actual.contentType !== expected.contentType ||
    actual.metadata?.sha256 !== expected.sha256 ||
    actual.metadata?.md5 !== expected.md5
  ) {
    throw new Error(`Immutable object verification failed for ${expected.key}`);
  }
}

function manifestRecord(image: ValidatedImage): PublishedImage {
  return {
    sha256: image.sha256,
    md5: image.md5,
    size: image.size,
    contentType: image.contentType,
    key: image.key,
  };
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

function isPreconditionFailed(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "PreconditionFailed" || candidate.$metadata?.httpStatusCode === 412;
}
