import {
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  paginateListObjectsV2,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { PublishedImage, ValidatedImage } from "./manifest.ts";

export type S3Target = {
  id: string;
  bucket: string;
  region: string;
  endpoint: string;
};

export type ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
  cacheControl?: string;
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
  immutable?: boolean;
  cacheControl?: string;
};

export interface S3Transport {
  head(target: S3Target, key: string): Promise<ObjectMetadata | undefined>;
  put(target: S3Target, object: ObjectPut): Promise<void>;
  get(
    target: S3Target,
    key: string,
    limit: number,
  ): Promise<Uint8Array | undefined>;
}

export class SdkS3Transport implements S3Transport {
  private readonly clients = new Map<string, S3Client>();
  private readonly credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };

  constructor(credentials: { accessKeyId: string; secretAccessKey: string }) {
    this.credentials = credentials;
  }

  async head(
    target: S3Target,
    key: string,
  ): Promise<ObjectMetadata | undefined> {
    try {
      const response = await this.client(target).send(
        new HeadObjectCommand({ Bucket: target.bucket, Key: key }),
      );
      return metadataFromHead(response);
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async put(target: S3Target, object: ObjectPut): Promise<void> {
    await this.client(target).send(
      new PutObjectCommand({
        Bucket: target.bucket,
        Key: object.key,
        Body: object.bytes,
        ContentType: object.contentType,
        ContentMD5: object.md5Base64,
        CacheControl: object.cacheControl ?? "private, no-store",
        Metadata: { sha256: object.sha256, md5: object.md5 },
        IfNoneMatch: object.immutable === false ? undefined : "*",
      }),
    );
  }

  async get(
    target: S3Target,
    key: string,
    limit: number,
  ): Promise<Uint8Array | undefined> {
    if (!Number.isSafeInteger(limit) || limit < 0)
      throw new Error("Invalid object read limit");
    try {
      const response = await this.client(target).send(
        new GetObjectCommand({ Bucket: target.bucket, Key: key }),
      );
      if (!response.Body) throw new Error("Source object has no body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        if (
          response.ContentLength !== undefined &&
          response.ContentLength > limit
        )
          throw new Error("Source object exceeds protocol limit");
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          size += chunk.byteLength;
          if (size > limit)
            throw new Error("Source object exceeds protocol limit");
          chunks.push(chunk);
        }
        return Buffer.concat(chunks, size);
      } finally {
        (response.Body as { destroy?: () => void }).destroy?.();
      }
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  close(): void {
    for (const client of this.clients.values()) client.destroy();
    this.clients.clear();
  }

  async listArchives(target: S3Target, namespace: string) {
    if (
      target.bucket !== "justindfuller-obsidian-state" ||
      !/^(production|staging|pr\/[1-9][0-9]*)$/.test(namespace)
    )
      throw new Error("Invalid archive maintenance target");
    const objects = [];
    const tokens = new Set<string>();
    let pages = 0;
    for await (const page of paginateListObjectsV2(
      { client: this.client(target), pageSize: 1000, stopOnSameToken: true },
      { Bucket: target.bucket, Prefix: `rollback/artifacts/${namespace}/` },
    )) {
      if (++pages > 20)
        throw new Error("Archive inventory exceeds maintenance limit");
      for (const object of page.Contents ?? [])
        objects.push({
          key: object.Key,
          size: object.Size,
          lastModified: object.LastModified?.toISOString(),
        });
      if (page.IsTruncated && (!page.NextContinuationToken || pages === 20))
        throw new Error("Incomplete archive inventory");
      if (page.IsTruncated && page.NextContinuationToken) {
        if (tokens.has(page.NextContinuationToken))
          throw new Error("Repeated archive inventory cursor");
        tokens.add(page.NextContinuationToken);
      }
    }
    return objects;
  }

  async deleteArchive(target: S3Target, key: string): Promise<void> {
    if (
      target.bucket !== "justindfuller-obsidian-state" ||
      !/^rollback\/artifacts\/(production|staging|pr\/[1-9][0-9]*)\/[a-f0-9]{64}\.tar$/.test(
        key,
      )
    )
      throw new Error("Invalid archive deletion target");
    await this.client(target).send(
      new DeleteObjectCommand({ Bucket: target.bucket, Key: key }),
    );
    if (await this.head(target, key))
      throw new Error("Archive deletion unverified");
  }

  private client(target: S3Target): S3Client {
    if (
      target.region !== "auto" ||
      !/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(
        target.endpoint,
      )
    )
      throw new Error("Configure an explicit Cloudflare R2 endpoint");
    let client = this.clients.get(target.endpoint);
    if (!client) {
      client = new S3Client({
        region: target.region,
        endpoint: target.endpoint,
        credentials: this.credentials,
        maxAttempts: 3,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
      this.clients.set(target.endpoint, client);
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
  if (!verified)
    throw new Error(`Uploaded object could not be verified in ${target.id}`);
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

export function metadataFromHead(
  output: HeadObjectCommandOutput,
): ObjectMetadata {
  return {
    contentLength: output.ContentLength,
    contentType: output.ContentType,
    cacheControl: output.CacheControl,
    metadata: output.Metadata,
  };
}

export function verifyMetadata(
  actual: ObjectMetadata,
  expected: {
    key: string;
    size: number;
    contentType: string;
    sha256: string;
    md5: string;
  },
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
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function isPreconditionFailed(error: unknown): boolean {
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "PreconditionFailed" ||
    candidate.$metadata?.httpStatusCode === 412
  );
}
