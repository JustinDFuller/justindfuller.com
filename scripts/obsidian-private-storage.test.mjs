import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { archiveKey, archiveTransfer } from "./obsidian-private-storage.mjs";

test("tested private archives survive authenticated checksummed handoff without source or report retention paths", async () => {
  const bytes = Buffer.from("private nonprod HTML artifact"),
    checksum = createHash("sha256").update(bytes).digest("hex");
  const key = archiveKey("preview", 403, "123-1", checksum);
  assert.equal(key, `artifacts/pr/403/123-1/${checksum}.tar`);
  assert.throws(() => archiveKey("production", undefined, "123", checksum));
  assert.throws(() => archiveKey("staging", undefined, "../report", checksum));
  const objects = new Map();
  let writes = 0;
  const store = {
    get: async (key) => objects.get(key),
    put: async (key, bytes, immutable) => {
      assert.equal(immutable, true);
      objects.set(key, bytes);
      writes++;
    },
  };
  await archiveTransfer(store, "upload", key, bytes, checksum);
  await archiveTransfer(store, "upload", key, bytes, checksum);
  assert.equal(writes, 1);
  assert.deepEqual(
    await archiveTransfer(store, "download", key, undefined, checksum),
    bytes,
  );
  objects.set(key, Buffer.from("changed"));
  await assert.rejects(
    archiveTransfer(store, "download", key, undefined, checksum),
  );
  await assert.rejects(
    archiveTransfer(store, "upload", key, Buffer.from("changed"), checksum),
  );
  await assert.rejects(
    archiveTransfer(
      store,
      "download",
      "reports/staging.json",
      undefined,
      checksum,
    ),
  );
});
