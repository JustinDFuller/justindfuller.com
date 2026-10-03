import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { test } from "node:test";
import { emptyManifest, parseManifest, serializeManifest, validateImage } from "../src/manifest.ts";
import { ImagePublisher, type ImageVault, type VaultImage } from "../src/publisher.ts";
import { verifyOrUpload, type ObjectMetadata, type ObjectPut, type S3Target, type S3Transport } from "../src/s3.ts";

const smallPng = makePng(1);
const targets: S3Target[] = [
  { id: "preview", bucket: "example-preview", region: "us-east-1" },
  { id: "production", bucket: "example-production", region: "us-east-1" },
];

test("validates supported raster signatures and content-addressed paths", () => {
  const png = validateImage("Blog/image/diagram.png", smallPng);
  assert.equal(png.contentType, "image/png");
  assert.equal(png.path, "image/diagram.png");
  assert.equal(png.sha256, createHash("sha256").update(smallPng).digest("hex"));
  assert.equal(png.md5, createHash("md5").update(smallPng).digest("hex"));
  assert.equal(png.key, `v1/${png.sha256}.png`);
  assert.equal(validateImage("Blog/image/photo.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9])).contentType, "image/jpeg");
});

test("rejects unsupported extensions, unsafe paths, invalid signatures, and oversize files", () => {
  assert.throws(() => validateImage("Blog/image/diagram.gif", smallPng), /Only JPG, PNG, and SVG/);
  assert.throws(() => validateImage("Blog/image/diagram.PNG", smallPng), /Only JPG, PNG, and SVG/);
  assert.throws(() => validateImage("Blog/image/../secret.png", smallPng), /Only files inside Blog\/image/);
  assert.throws(() => validateImage("Blog/image/diagram.png", new Uint8Array([1, 2, 3])), /signature is invalid/);
  assert.throws(() => validateImage("Blog/image/diagram.png", new Uint8Array(9), 8), /between 1 byte/);
});

test("allows a static SVG subset and rejects active, external, and malformed content", () => {
  const safe = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="url(#paint)"/><defs><linearGradient id="paint"><stop offset="0" stop-color="#fff"/></linearGradient></defs></svg>');
  assert.equal(validateImage("Blog/image/shape.svg", safe).contentType, "image/svg+xml");
  for (const unsafe of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path onload="alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/a.svg#x"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    '<svg><g></svg>',
  ]) {
    assert.throws(() => validateImage("Blog/image/shape.svg", new TextEncoder().encode(unsafe)));
  }
});

test("publishes to every destination and records the manifest only after verification", async () => {
  const vault = new MemoryVault([{ path: "Blog/image/diagram.png", size: smallPng.byteLength, mtime: 100 }], { "Blog/image/diagram.png": smallPng });
  const transport = new MemoryS3();
  transport.failBucket = "example-production";
  const publisher = new ImagePublisher({ vault, targets, transport });
  const first = await publisher.reconcile();
  assert.equal(first.failed.length, 1);
  assert.equal(vault.manifest, undefined);
  assert.equal(transport.objects.has(`example-preview:v1/${createHash("sha256").update(smallPng).digest("hex")}.png`), true);
  transport.failBucket = undefined;
  const second = await publisher.reconcile();
  assert.deepEqual(second.uploaded, ["Blog/image/diagram.png"]);
  const manifest = parseManifest(vault.manifest ?? "");
  assert.deepEqual(manifest.images["image/diagram.png"], {
    sha256: createHash("sha256").update(smallPng).digest("hex"),
    md5: createHash("md5").update(smallPng).digest("hex"),
    size: smallPng.byteLength,
    contentType: "image/png",
    key: `v1/${createHash("sha256").update(smallPng).digest("hex")}.png`,
  });
  assert.equal(transport.puts, 3);
});

test("startup reconciliation repairs a missing immutable object without rewriting unchanged files", async () => {
  const vault = new MemoryVault([{ path: "Blog/image/diagram.png", size: smallPng.byteLength, mtime: 100 }], { "Blog/image/diagram.png": smallPng });
  const transport = new MemoryS3();
  const publisher = new ImagePublisher({ vault, targets: [targets[0]], transport });
  await publisher.reconcile();
  const initialReads = vault.reads;
  const initialWrites = vault.writes;
  await publisher.reconcile();
  assert.equal(vault.reads, initialReads);
  assert.equal(vault.writes, initialWrites);
  const record = publisher.getManifest().images["image/diagram.png"];
  transport.objects.delete(`${targets[0].bucket}:${record.key}`);
  const repaired = await publisher.reconcile();
  assert.deepEqual(repaired.uploaded, ["Blog/image/diagram.png"]);
  assert.equal(transport.objects.has(`${targets[0].bucket}:${record.key}`), true);
});

test("revalidates local bytes when a synced manifest record changes", async () => {
  const vault = new MemoryVault([{ path: "Blog/image/diagram.png", size: smallPng.byteLength, mtime: 100 }], { "Blog/image/diagram.png": smallPng });
  const transport = new MemoryS3();
  const publisher = new ImagePublisher({ vault, targets: [targets[0]], transport });
  await publisher.reconcile();
  const reads = vault.reads;
  vault.manifest = JSON.stringify({
    version: 1,
    images: {
      "image/diagram.png": {
        sha256: "c".repeat(64),
        md5: "d".repeat(32),
        size: smallPng.byteLength,
        contentType: "image/png",
        key: `v1/${"c".repeat(64)}.png`,
      },
    },
  });
  await publisher.reconcile();
  assert.equal(vault.reads, reads + 1);
  assert.equal(parseManifest(vault.manifest ?? "").images["image/diagram.png"].sha256, createHash("sha256").update(smallPng).digest("hex"));
});

test("invalid existing manifest blocks publishing and is left untouched", async () => {
  const vault = new MemoryVault([{ path: "Blog/image/diagram.png", size: smallPng.byteLength, mtime: 100 }], { "Blog/image/diagram.png": smallPng });
  vault.manifest = '{"version":1,"images":{"image/bad.GIF":{}}}';
  const transport = new MemoryS3();
  const publisher = new ImagePublisher({ vault, targets: [targets[0]], transport });
  await assert.rejects(publisher.reconcile(), /invalid/);
  assert.equal(transport.puts, 0);
  assert.equal(vault.writes, 0);
  assert.equal(vault.manifest, '{"version":1,"images":{"image/bad.GIF":{}}}');
});

test("an event invalidation catches same-size same-mtime edits", async () => {
  const updatedPng = makePng(2);
  const vault = new MemoryVault([{ path: "Blog/image/diagram.png", size: smallPng.byteLength, mtime: 100 }], { "Blog/image/diagram.png": smallPng });
  const transport = new MemoryS3();
  const publisher = new ImagePublisher({ vault, targets: [targets[0]], transport });
  await publisher.reconcile();
  vault.bytes.set("Blog/image/diagram.png", updatedPng);
  publisher.invalidate("Blog/image/diagram.png");
  const result = await publisher.reconcile();
  assert.deepEqual(result.uploaded, ["Blog/image/diagram.png"]);
  assert.equal(Object.keys(publisher.getManifest().images).length, 1);
  assert.equal(transport.puts, 2);
});

test("manifest parser rejects malformed records and serialization is stable", () => {
  const manifest = emptyManifest();
  manifest.images["image/a.png"] = {
    sha256: "a".repeat(64),
    md5: "b".repeat(32),
    size: 8,
    contentType: "image/png",
    key: `v1/${"a".repeat(64)}.png`,
  };
  const text = serializeManifest(manifest);
  assert.deepEqual(parseManifest(text), manifest);
  assert.throws(() => parseManifest(JSON.stringify({ version: 1, images: { "image/../bad.png": manifest.images["image/a.png"], bad: {} } })), /invalid/);
  assert.throws(() => parseManifest('{"version":2,"images":{}}'), /version or images map/);
});

test("conditional write races are verified instead of overwriting the existing key", async () => {
  const image = validateImage("Blog/image/diagram.png", smallPng);
  const transport = new MemoryS3();
  transport.race = true;
  const result = await verifyOrUpload(transport, targets[0], image, createHash("md5").update(smallPng).digest("base64"));
  assert.equal(result.uploaded, true);
  assert.equal(transport.puts, 1);
});

class MemoryVault implements ImageVault {
  manifest: string | undefined;
  reads = 0;
  writes = 0;
  private readonly files: VaultImage[];
  readonly bytes: Map<string, Uint8Array>;

  constructor(files: VaultImage[], bytes: Record<string, Uint8Array>) {
    this.files = files;
    this.bytes = new Map(Object.entries(bytes));
  }

  listImages(): VaultImage[] {
    return this.files;
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    this.reads++;
    const bytes = this.bytes.get(path);
    if (!bytes) throw new Error("file missing");
    return bytes.slice().buffer;
  }

  async readText(path: string): Promise<string | undefined> {
    return path === "Blog/asset-manifest.json" ? this.manifest : undefined;
  }

  async writeText(path: string, value: string): Promise<void> {
    assert.equal(path, "Blog/asset-manifest.json");
    this.writes++;
    this.manifest = value;
  }
}

function makePng(red: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, 1);
  new DataView(header.buffer).setUint32(4, 1);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array([0, red, 0, 0, 255]);
  return concatenate(signature, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array()));
}

function chunk(name: string, data: Uint8Array): Uint8Array {
  const type = new TextEncoder().encode(name);
  const result = new Uint8Array(12 + data.byteLength);
  new DataView(result.buffer).setUint32(0, data.byteLength);
  result.set(type, 4);
  result.set(data, 8);
  new DataView(result.buffer).setUint32(8 + data.byteLength, crc32(concatenate(type, data)));
  return result;
}

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class MemoryS3 implements S3Transport {
  objects = new Map<string, ObjectMetadata>();
  puts = 0;
  failBucket: string | undefined;
  race = false;

  async head(target: S3Target, key: string): Promise<ObjectMetadata | undefined> {
    return this.objects.get(`${target.bucket}:${key}`);
  }

  async put(target: S3Target, object: ObjectPut): Promise<void> {
    this.puts++;
    if (this.failBucket === target.bucket) throw new Error("mock S3 upload failure");
    const id = `${target.bucket}:${object.key}`;
    const metadata = { contentLength: object.bytes.byteLength, contentType: object.contentType, metadata: { sha256: object.sha256, md5: object.md5 } };
    if (this.race) {
      this.objects.set(id, metadata);
      const error = new Error("Precondition failed") as Error & { name: string; $metadata: { httpStatusCode: number } };
      error.name = "PreconditionFailed";
      error.$metadata = { httpStatusCode: 412 };
      throw error;
    }
    this.objects.set(id, metadata);
  }
}
