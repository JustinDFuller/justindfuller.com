import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  canonicalSnapshot,
  hash,
  publishSnapshot,
  type VaultSource,
} from "../src/content.ts";
import {
  type ObjectMetadata,
  type ObjectPut,
  type S3Target,
  type S3Transport,
} from "../src/s3.ts";

const target: S3Target = {
  id: "source",
  bucket: "private-source",
  region: "auto",
  endpoint: `https://${"a".repeat(32)}.r2.cloudflarestorage.com`,
};
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>',
);

class MemoryStorage implements S3Transport {
  objects = new Map<string, Uint8Array>();
  metadata = new Map<string, ObjectMetadata>();
  puts: ObjectPut[] = [];
  failKey: string | undefined;
  async head(_: S3Target, key: string) {
    return this.metadata.get(key);
  }
  async get(_: S3Target, key: string, limit: number) {
    const bytes = this.objects.get(key);
    if (bytes && bytes.byteLength > limit) throw new Error("limit");
    return bytes;
  }
  async put(_: S3Target, object: ObjectPut) {
    if (object.key === this.failKey) throw new Error("interrupted upload");
    assert.equal(object.bucket, "private-source");
    assert.notEqual(object.cacheControl, "public, max-age=31536000, immutable");
    this.puts.push(object);
    this.objects.set(object.key, object.bytes);
    this.metadata.set(object.key, {
      contentLength: object.bytes.byteLength,
      contentType: object.contentType,
      metadata: { sha256: object.sha256, md5: object.md5 },
    });
  }
}

class MemoryVault implements VaultSource {
  files: Record<string, Uint8Array>;
  failPath: string | undefined;
  constructor(files: Record<string, Uint8Array>) {
    this.files = files;
  }
  async paths() {
    return Object.keys(this.files);
  }
  async read(path: string) {
    if (path === this.failPath) throw new Error("incomplete scan");
    return this.files[path];
  }
}

test("complete private snapshots retain invalid Markdown and ignore unrelated vault files", async () => {
  const vault = new MemoryVault({
    "Blog/post.md": Buffer.from([255]),
    "Blog/image/a.svg": svg,
    "Blog/nested/not-root.md": Buffer.from("private"),
    "Journal/private.md": Buffer.from("private"),
  });
  const storage = new MemoryStorage();
  const result = await publishSnapshot(vault, storage, target);
  assert.deepEqual(Object.keys(result.snapshot.files), ["post.md"]);
  assert.equal(
    result.snapshot.files["post.md"].sha256,
    hash(Buffer.from([255])),
  );
  assert.equal(result.snapshot.images["image/a.svg"].sha256, hash(svg));
  assert.deepEqual(result.issues, [
    { path: "nested/not-root.md", category: "unsupported_source" },
  ]);
  assert.equal(storage.puts.at(-1)?.key, "latest.json");
  assert.equal(storage.puts.at(-1)?.immutable, false);
  assert.equal(
    JSON.parse(Buffer.from(storage.objects.get("latest.json")!).toString())
      .revision,
    result.revision,
  );
  assert.equal(result.revision, hash(canonicalSnapshot(result.snapshot)));
});

test("unchanged scans never upload or activate and failed scans retain the previous pointer", async () => {
  const vault = new MemoryVault({
    "Blog/post.md": Buffer.from("original"),
    "Blog/image/a.svg": svg,
  });
  const storage = new MemoryStorage();
  const accepted = await publishSnapshot(vault, storage, target);
  const original = Buffer.from(storage.objects.get("latest.json")!);
  storage.puts = [];
  const unchanged = await publishSnapshot(vault, storage, target, accepted);
  assert.equal(unchanged.activated, false);
  assert.equal(storage.puts.length, 0);
  vault.files["Blog/post.md"] = Buffer.from("new");
  vault.failPath = "Blog/post.md";
  await assert.rejects(
    publishSnapshot(vault, storage, target, accepted),
    /incomplete scan/,
  );
  assert.deepEqual(Buffer.from(storage.objects.get("latest.json")!), original);
  vault.failPath = undefined;
  storage.failKey = "latest.json";
  await assert.rejects(
    publishSnapshot(vault, storage, target, accepted),
    /interrupted upload/,
  );
  assert.deepEqual(Buffer.from(storage.objects.get("latest.json")!), original);
});

test("invalid image revisions retain verified mappings while unrelated Markdown activates", async () => {
  const vault = new MemoryVault({
    "Blog/post.md": Buffer.from("original"),
    "Blog/image/a.svg": svg,
  });
  const storage = new MemoryStorage();
  const accepted = await publishSnapshot(vault, storage, target);
  vault.files["Blog/post.md"] = Buffer.from("changed");
  vault.files["Blog/image/a.svg"] = Buffer.from(
    "<svg><script>x</script></svg>",
  );
  const changed = await publishSnapshot(vault, storage, target, accepted);
  assert.equal(changed.activated, true);
  assert.deepEqual(changed.snapshot.images, accepted.snapshot.images);
  assert.deepEqual(changed.issues, [
    { path: "image/a.svg", category: "image_validation" },
  ]);
  assert.equal(
    changed.snapshot.files["post.md"].sha256,
    hash(Buffer.from("changed")),
  );
  storage.metadata.delete(accepted.snapshot.images["image/a.svg"].key);
  await assert.rejects(
    publishSnapshot(vault, storage, target, changed),
    /Previous image is unavailable/,
  );
});

test("integrity failures and unsafe scan paths never replace the active pointer", async () => {
  const storage = new MemoryStorage();
  const vault = new MemoryVault({ "Blog/post.md": Buffer.from("original") });
  const accepted = await publishSnapshot(vault, storage, target);
  const pointer = Buffer.from(storage.objects.get("latest.json")!);
  const record = accepted.snapshot.files["post.md"];
  storage.metadata.set(record.key, {
    contentLength: record.size,
    contentType: "text/markdown; charset=utf-8",
    metadata: {
      sha256: "bad",
      md5: createHash("md5").update(vault.files["Blog/post.md"]).digest("hex"),
    },
  });
  await assert.rejects(
    publishSnapshot(vault, storage, target, accepted),
    /verification failed/,
  );
  assert.deepEqual(Buffer.from(storage.objects.get("latest.json")!), pointer);
  await assert.rejects(
    publishSnapshot(
      new MemoryVault({ "Blog/image/../secret.svg": svg }),
      storage,
      target,
    ),
    /unsafe paths/,
  );
});
