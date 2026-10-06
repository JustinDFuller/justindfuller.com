import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PrivateR2Store,
  r2Target,
  promoteProductionImages,
  publicImageCache,
} from "../tools/obsidian-image-publisher/src/publication.ts";
import { validateImage } from "../tools/obsidian-image-publisher/src/manifest.ts";
import { PublicationTransaction } from "./obsidian-transaction.mjs";

function transport() {
  const objects = new Map(),
    operations = [];
  return {
    objects,
    operations,
    head: async (target, key) => {
      operations.push({ method: "HEAD", bucket: target.bucket, key });
      const object = objects.get(key);
      return object
        ? {
            contentLength: object.bytes.length,
            contentType: object.contentType,
            cacheControl: object.cacheControl,
            metadata: { sha256: object.sha256, md5: object.md5 },
          }
        : undefined;
    },
    get: async (target, key, limit) => {
      operations.push({ method: "GET", bucket: target.bucket, key });
      const object = objects.get(key);
      if (object?.bytes.length > limit) throw new Error("bounded read");
      return object?.bytes;
    },
    put: async (target, object) => {
      operations.push({
        method: "PUT",
        bucket: target.bucket,
        key: object.key,
      });
      objects.set(object.key, object);
    },
  };
}
const account = "a".repeat(32);
const target = (bucket) =>
  r2Target(account, `justindfuller-obsidian-${bucket}`);
const image = (bytes) =>
  validateImage("Blog/image/test.jpg", Buffer.from(bytes));
const original = image([255, 216, 255, 217]);
const record = ({ bytes: _bytes, path: _path, ...value }) => value;
function sourceImage(store, value) {
  store.objects.set(value.key, { ...value, cacheControl: "private, no-store" });
}

test("promotion touches only effective production references and keeps immutable public caching", async () => {
  const source = transport(),
    media = transport();
  sourceImage(source, original);
  const unpublished = image([255, 216, 255, 0, 255, 217]);
  sourceImage(source, unpublished);
  const prepared = {
    version: 1,
    mode: "production",
    images: { [original.key]: record(original) },
  };
  const result = await promoteProductionImages(
    prepared,
    { transport: source, target: target("source") },
    { transport: media, target: target("media") },
  );
  assert.deepEqual(result.verified, [original.key]);
  assert.equal(result.copied, 1);
  assert.equal(media.objects.size, 1);
  assert.equal(media.objects.get(original.key).cacheControl, publicImageCache);
  assert.ok(
    source.operations.every((operation) => operation.key === original.key),
  );
  source.operations.length = 0;
  media.operations.length = 0;
  const repeated = await promoteProductionImages(
    prepared,
    { transport: source, target: target("source") },
    { transport: media, target: target("media") },
  );
  assert.equal(repeated.copied, 0);
  assert.equal(source.operations.length, 0);
  assert.ok(media.operations.every((operation) => operation.method === "HEAD"));
  for (const mode of ["staging", "preview", "local", "nonprod"])
    await assert.rejects(
      promoteProductionImages(
        { ...prepared, mode },
        { transport: source, target: target("source") },
        { transport: media, target: target("media") },
      ),
    );
});

test("corrupt or missing image originals and public metadata failures remain isolated", async () => {
  const source = transport(),
    media = transport();
  const corrupt = image([255, 216, 255, 1, 255, 217]);
  const missing = image([255, 216, 255, 2, 255, 217]);
  sourceImage(source, original);
  sourceImage(source, corrupt);
  source.objects.get(corrupt.key).bytes = Buffer.from("invalid image");
  const prepared = {
    version: 1,
    mode: "production",
    images: Object.fromEntries(
      [original, corrupt, missing].map((item) => [item.key, record(item)]),
    ),
  };
  const result = await promoteProductionImages(
    prepared,
    { transport: source, target: target("source") },
    { transport: media, target: target("media") },
  );
  assert.deepEqual(result.verified, [original.key]);
  assert.deepEqual(
    new Set(result.unavailable),
    new Set([corrupt.key, missing.key]),
  );
  assert.equal(media.objects.size, 1);
  media.objects.get(original.key).md5 = "f".repeat(32);
  const retry = await promoteProductionImages(
    prepared,
    { transport: source, target: target("source") },
    { transport: media, target: target("media") },
  );
  assert.equal(retry.verified.length, 0);
  await assert.rejects(
    promoteProductionImages(
      prepared,
      { transport: source, target: target("source") },
      {
        transport: {
          ...media,
          head: async () => {
            throw { $metadata: { httpStatusCode: 403 } };
          },
        },
        target: target("media"),
      },
    ),
    /authority/,
  );
});

test("private state storage verifies metadata and bodies across fresh transaction adapters", async () => {
  const sdk = transport();
  const store = new PrivateR2Store(sdk, target("state"));
  let identity = "prior";
  const serving = {
    identity: async () => identity,
    capture: async () => ({
      deployment: identity,
      artifact: "f".repeat(64),
      archive: "rollback/staging/prior.tar",
      verification: { pages: [] },
    }),
    deploy: async () => {
      identity = "candidate";
      return identity;
    },
    verify: async (receipt) => assert.equal(receipt.deployment, identity),
    rollback: async (previous) => {
      identity = previous;
    },
  };
  const candidate = {
    source: "a".repeat(64),
    code: "b".repeat(64),
    digest: "c".repeat(64),
    artifact: "d".repeat(64),
    state: { mode: "staging" },
    archive: "artifacts/staging/1/build.tar",
    verification: { pages: [] },
  };
  await new PublicationTransaction(store, serving, "staging").publish(
    candidate,
    { bootstrap: true },
  );
  const fresh = new PublicationTransaction(
    new PrivateR2Store(sdk, target("state")),
    serving,
    "staging",
  );
  assert.equal(
    (await fresh.publish({ ...candidate, source: "e".repeat(64) })).skipped,
    true,
  );
  const key = fresh.currentKey;
  const bytes = sdk.objects.get(key).bytes;
  assert.equal(
    sdk.objects.get(key).sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.equal(sdk.objects.get(key).cacheControl, "private, no-store");
  sdk.objects.get(key).bytes = Buffer.from("corruption");
  await assert.rejects(fresh.read(key), /integrity/);
  for (const path of [
    "../source",
    "reports/../escape",
    "markdown/v1/x.md",
    "reports//x.json",
  ])
    await assert.rejects(store.get(path));
  assert.throws(() => new PrivateR2Store(sdk, target("media")));
});
