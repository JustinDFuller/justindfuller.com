import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createPublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";
import { captureBootstrapReceipt } from "./capture-obsidian-bootstrap.mjs";

const account = "a".repeat(32);
const identity = "11111111-1111-1111-1111-111111111111";

function makeArchive(mode, contents = "Git-only baseline") {
  const directory = mkdtempSync(join(tmpdir(), "obsidian-bootstrap-"));
  mkdirSync(join(directory, "dist"), { recursive: true });
  mkdirSync(join(directory, ".cloudflare/output/v0/workers/default/assets"), {
    recursive: true,
  });
  writeFileSync(join(directory, "dist/index.html"), contents);
  writeFileSync(
    join(directory, ".cloudflare/output/v0/config.json"),
    JSON.stringify({
      accountId: account,
      buildContext: { mode, isPreview: mode === "preview" },
    }),
  );
  writeFileSync(
    join(directory, ".cloudflare/output/v0/workers/default/worker.config.json"),
    JSON.stringify({
      name:
        mode === "staging"
          ? "justindfuller-site-staging"
          : "justindfuller-site",
      workersDev: mode === "preview",
      previewUrls: mode !== "staging",
      domains:
        mode === "production"
          ? ["justindfuller.com", "www.justindfuller.com"]
          : mode === "staging"
            ? ["staging.justindfuller.com"]
            : [],
      env: {},
    }),
  );
  writeFileSync(join(directory, ".cloudflare/site-manifest.json"), "{}");
  const bytes = createPublicationArchive(directory);
  rmSync(directory, { recursive: true, force: true });
  return { bytes, checksum: archiveChecksum(bytes) };
}

function fixture(mode, options = {}) {
  const pr = mode === "preview" ? 403 : undefined;
  const archive = makeArchive(mode);
  const objects = new Map();
  const writes = [];
  const store = {
    get: async (key) => {
      if (options.failReadback && writes.length && key === writes[0].key)
        throw new Error("read failure");
      return objects.has(key) ? Buffer.from(objects.get(key)) : undefined;
    },
    put: async (key, bytes, immutable) => {
      writes.push({ key, immutable });
      if (options.writeMode === "omit") return;
      if (options.writeMode === "corrupt") {
        objects.set(key, Buffer.from("corrupt"));
        return;
      }
      if (immutable && objects.has(key)) throw new Error("precondition failed");
      objects.set(key, Buffer.from(bytes));
      if (options.writeMode === "ambiguous")
        throw new Error("write response lost");
    },
  };
  let live = identity;
  let verification;
  const verifiedReceipts = [];
  const serving = {
    account,
    mode,
    pr,
    identity: async () => live,
    verify: async (receipt) => {
      verifiedReceipts.push(receipt);
      verification?.(receipt, () => {
        live = "22222222-2222-2222-2222-222222222222";
      });
    },
  };
  return {
    archive,
    objects,
    pr,
    serving,
    store,
    verifiedReceipts,
    writes,
    setLive(value) {
      live = value;
    },
    setVerification(callback) {
      verification = callback;
    },
  };
}

test("captures and verifies a retained prior artifact for each target", async () => {
  for (const mode of ["production", "staging", "preview"]) {
    const f = fixture(mode);
    const namespace = mode === "preview" ? `pr/${f.pr}` : mode;
    const receipt = await captureBootstrapReceipt({
      store: f.store,
      serving: f.serving,
      mode,
      pr: f.pr,
      archive: f.archive.bytes,
      checksum: f.archive.checksum,
    });
    const key = `rollback/artifacts/${namespace}/${f.archive.checksum}.tar`;
    assert.deepEqual(receipt, {
      deployment: identity,
      artifact: f.archive.checksum,
      archive: key,
      verification: {},
    });
    assert.deepEqual(f.objects.get(key), f.archive.bytes);
    assert.deepEqual(f.writes, [{ key, immutable: true }]);
    assert.deepEqual(f.verifiedReceipts, [receipt]);
    assert.equal(f.serving.deploy, undefined);
  }
});

test("reuses only an identical immutable archive and verifies it again", async () => {
  const f = fixture("staging");
  const key = `rollback/artifacts/staging/${f.archive.checksum}.tar`;
  f.objects.set(key, Buffer.from(f.archive.bytes));
  await captureBootstrapReceipt({
    store: f.store,
    serving: f.serving,
    mode: "staging",
    archive: f.archive.bytes,
    checksum: f.archive.checksum,
  });
  assert.deepEqual(f.writes, []);
});

test("accepts an ambiguous immutable write only after exact readback", async () => {
  const f = fixture("production", { writeMode: "ambiguous" });
  const receipt = await captureBootstrapReceipt({
    store: f.store,
    serving: f.serving,
    mode: "production",
    archive: f.archive.bytes,
    checksum: f.archive.checksum,
  });
  assert.equal(receipt.artifact, f.archive.checksum);
});

test("rejects bad checksum, mismatched target, and nonmatching immutable bytes before verification", async () => {
  const corrupt = fixture("production");
  const changed = Buffer.from(corrupt.archive.bytes);
  changed[0] ^= 1;
  await assert.rejects(
    captureBootstrapReceipt({
      store: corrupt.store,
      serving: corrupt.serving,
      mode: "production",
      archive: changed,
      checksum: corrupt.archive.checksum,
    }),
    /checksum differs/,
  );
  assert.equal(corrupt.writes.length, 0);

  const wrongTarget = fixture("production");
  const staging = makeArchive("staging");
  await assert.rejects(
    captureBootstrapReceipt({
      store: wrongTarget.store,
      serving: wrongTarget.serving,
      mode: "production",
      archive: staging.bytes,
      checksum: staging.checksum,
    }),
    /archive target is invalid/,
  );
  assert.equal(wrongTarget.writes.length, 0);

  const conflict = fixture("staging");
  const key = `rollback/artifacts/staging/${conflict.archive.checksum}.tar`;
  conflict.objects.set(key, Buffer.from("different immutable value"));
  await assert.rejects(
    captureBootstrapReceipt({
      store: conflict.store,
      serving: conflict.serving,
      mode: "staging",
      archive: conflict.archive.bytes,
      checksum: conflict.archive.checksum,
    }),
    /already differs/,
  );
  assert.deepEqual(conflict.writes, []);
});

test("fails closed when archive retention or readback cannot be verified", async () => {
  for (const writeMode of ["omit", "corrupt"]) {
    const f = fixture("preview", { writeMode });
    await assert.rejects(
      captureBootstrapReceipt({
        store: f.store,
        serving: f.serving,
        mode: "preview",
        pr: f.pr,
        archive: f.archive.bytes,
        checksum: f.archive.checksum,
      }),
      /readback differs/,
    );
  }
  const unreadable = fixture("production", { failReadback: true });
  await assert.rejects(
    captureBootstrapReceipt({
      store: unreadable.store,
      serving: unreadable.serving,
      mode: "production",
      archive: unreadable.archive.bytes,
      checksum: unreadable.archive.checksum,
    }),
    /readback is unavailable/,
  );
});

test("requires current exact identity verification and refuses identity changes", async () => {
  const failed = fixture("staging");
  failed.setVerification(() => {
    throw new Error("serving verification failed");
  });
  await assert.rejects(
    captureBootstrapReceipt({
      store: failed.store,
      serving: failed.serving,
      mode: "staging",
      archive: failed.archive.bytes,
      checksum: failed.archive.checksum,
    }),
    /artifact verification failed/,
  );

  const changed = fixture("preview");
  changed.setVerification((_receipt, changeIdentity) => changeIdentity());
  await assert.rejects(
    captureBootstrapReceipt({
      store: changed.store,
      serving: changed.serving,
      mode: "preview",
      pr: changed.pr,
      archive: changed.archive.bytes,
      checksum: changed.archive.checksum,
    }),
    /identity or target changed/,
  );

  const wrongTarget = fixture("preview");
  wrongTarget.serving.pr = 404;
  await assert.rejects(
    captureBootstrapReceipt({
      store: wrongTarget.store,
      serving: wrongTarget.serving,
      mode: "preview",
      pr: 403,
      archive: wrongTarget.archive.bytes,
      checksum: wrongTarget.archive.checksum,
    }),
    /target is invalid/,
  );
});
