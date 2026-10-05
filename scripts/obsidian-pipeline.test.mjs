import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  preparationCode,
  readPrivatePreparation,
} from "./prepare-obsidian-target.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import {
  preparePublicationTarget,
  uploadPreparationBundle,
  downloadPreparationBundle,
  preparationBundleKey,
} from "./obsidian-pipeline.mjs";

const sha = "a".repeat(40),
  source = "b".repeat(64),
  old = "c".repeat(64),
  digest = "d".repeat(64),
  changed = "e".repeat(64),
  artifact = "f".repeat(64),
  identity = "11111111-1111-1111-1111-111111111111";
function values(mode = "staging", revision = source, effective = digest) {
  const state = {
      version: 1,
      mode,
      revision,
      files: { "private-canary.md": "private body" },
    },
    prepared = {
      version: 1,
      mode,
      revision,
      digest: effective,
      state,
      entries: [{ title: "private title" }],
      images: {},
    },
    candidate = {
      source: revision,
      code: preparationCode(sha, mode),
      codeSha: sha,
      digest: effective,
      state,
      verification: { prepared },
    },
    diagnostics = {
      version: 1,
      mode,
      source: revision,
      digest: effective,
      files: [{ path: "private-canary.md" }],
      issues: [],
    };
  return { candidate, diagnostics };
}
function memoryStore() {
  const objects = new Map(),
    writes = [];
  return {
    objects,
    writes,
    get: async (key) => objects.get(key),
    put: async (key, bytes, immutable) => {
      writes.push({ key, immutable });
      objects.set(key, Buffer.from(bytes));
    },
  };
}
async function fixture(t, mode = "staging", options = {}) {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-pipeline-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const store = memoryStore(),
    previous = values(mode, old),
    trace = [];
  store.objects.set(
    `accepted/${mode}/current.json`,
    Buffer.from(
      JSON.stringify({
        version: 1,
        namespace: mode,
        ...previous.candidate,
        artifact,
        archive: `rollback/${mode}/${artifact}.tar`,
        receipt: { deployment: identity, artifact },
        verification: previous.candidate.verification,
      }),
    ),
  );
  let preparations = 0;
  const execute = async (command, args) => {
      if (command === "git")
        return {
          stdout: `${options.codeChanged && preparations > 1 ? "9".repeat(40) : sha}\n`,
        };
      if (args.includes("--validate-promotion")) {
        trace.push("authorize");
        return { stdout: "private canary" };
      }
      if (options.outage && args.includes("--r2")) throw Error("private error");
      preparations++;
      const fallback = args.includes("--accepted-only"),
        revision = fallback ? old : source,
        effective = preparations > 1 && options.finalChanged ? changed : digest,
        current = values(mode, revision, effective),
        flag = (name) => args[args.indexOf(name) + 1];
      if (fallback)
        current.diagnostics.issues.push({
          key: old,
          category: "source_degraded",
        });
      if (preparations > 1) {
        assert.equal(args.includes("--r2"), false);
        assert.ok(
          args.includes(fallback ? "--unavailable-images" : "--source"),
        );
        trace.push("final-prepare");
      }
      await saveProtectedReport(
        flag("--out"),
        current.candidate.verification.prepared,
        cwd,
      );
      await saveProtectedReport(flag("--report-out"), current.diagnostics, cwd);
      if (args.includes("--source-out"))
        await saveProtectedReport(
          flag("--source-out"),
          { revision, ready: {} },
          cwd,
        );
      return { stdout: "private output" };
    },
    serving = {
      identity: async () => identity,
      verify: async () => {
        trace.push("verify-retained");
      },
    },
    promote = async () => {
      trace.push("promotion");
      return { verified: [], unavailable: [], copied: 0, bytes: 0 };
    };
  return { cwd, store, serving, mode, run: "123-1", execute, promote, trace };
}

test("final production digest is computed after authorized image verification and before private build handoff", async (t) => {
  const f = await fixture(t, "production", { finalChanged: true }),
    previous = f.store.objects.get("accepted/production/current.json"),
    result = await preparePublicationTarget(f);
  assert.equal(result.decision, "build-required");
  assert.equal(result.digest, changed);
  assert.deepEqual(f.trace, ["authorize", "promotion", "final-prepare"]);
  assert.deepEqual(
    f.store.objects.get("accepted/production/current.json"),
    previous,
  );
  const bundle = await downloadPreparationBundle(
    f.store,
    result.handoff.checksum,
    { mode: f.mode, run: f.run, codeSha: sha },
  );
  assert.equal(bundle.candidate.digest, changed);
  assert.equal(
    bundle.candidate.verification.prepared.state.files["private-canary.md"],
    "private body",
  );
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(
    f.store.writes.find((x) => x.key === result.handoff.key).immutable,
    true,
  );
});

test("unchanged target verifies its retained artifact and skips handoff; content outages retain serving state", async (t) => {
  for (const mode of ["production", "staging"]) {
    const f = await fixture(t, mode),
      result = await preparePublicationTarget(f);
    assert.equal(result.decision, "skip-build");
    assert.equal(result.receipt.skipped, true);
    assert.equal(
      f.store.writes.some((x) => x.key.startsWith("candidates/")),
      false,
    );
    assert.equal(
      JSON.parse(f.store.objects.get(`accepted/${mode}/current.json`)).source,
      source,
    );
    assert.ok(f.trace.includes("verify-retained"));
  }
  const f = await fixture(t, "production", { outage: true }),
    before = f.store.objects.get("accepted/production/current.json"),
    result = await preparePublicationTarget({ ...f, kind: "content" });
  assert.equal(result.decision, "retain-serving");
  assert.deepEqual(f.trace, []);
  assert.deepEqual(
    f.store.objects.get("accepted/production/current.json"),
    before,
  );
});

test("code-build source fallback verifies production images and keeps degraded diagnostics", async (t) => {
  const f = await fixture(t, "production", {
      outage: true,
      finalChanged: true,
    }),
    result = await preparePublicationTarget(f);
  assert.equal(result.decision, "build-required");
  assert.equal(result.sourceAvailable, false);
  assert.equal(result.source, old);
  assert.equal(result.issues, 1);
  assert.deepEqual(f.trace, ["authorize", "promotion", "final-prepare"]);
});

test("promotion or checkout failure cannot advance accepted state or upload build inputs", async (t) => {
  for (const options of [{ codeChanged: true, finalChanged: true }, {}]) {
    const f = await fixture(t, "production", options),
      before = f.store.objects.get("accepted/production/current.json");
    if (!options.codeChanged)
      f.promote = async () => {
        throw Error("permission denied");
      };
    await assert.rejects(preparePublicationTarget(f));
    assert.deepEqual(
      f.store.objects.get("accepted/production/current.json"),
      before,
    );
    assert.equal(
      f.store.writes.some((x) => x.key.startsWith("candidates/")),
      false,
    );
  }
});

test("private handoff is immutable, checksummed, bounded and tied to target, run and exact code", async () => {
  const store = memoryStore(),
    target = { mode: "preview", pr: 403, run: "123-1", codeSha: sha },
    bundle = {
      version: 1,
      target: "pr/403",
      run: target.run,
      codeSha: sha,
      ...values("preview"),
    };
  const upload = await uploadPreparationBundle(store, bundle, target);
  await uploadPreparationBundle(store, bundle, target);
  assert.equal(store.writes.length, 1);
  assert.deepEqual(
    await downloadPreparationBundle(store, upload.checksum, target),
    bundle,
  );
  for (const override of [
    { pr: 404 },
    { run: "124-1" },
    { codeSha: "9".repeat(40) },
    { mode: "staging", pr: undefined },
  ])
    await assert.rejects(
      downloadPreparationBundle(store, upload.checksum, {
        ...target,
        ...override,
      }),
    );
  const invalid = structuredClone(bundle);
  invalid.candidate.state.revision = old;
  await assert.rejects(uploadPreparationBundle(store, invalid, target));
  store.objects.set(upload.key, Buffer.from("corrupt"));
  await assert.rejects(
    downloadPreparationBundle(store, upload.checksum, target),
  );
  assert.throws(() => preparationBundleKey("local", undefined, "123", digest));
  assert.throws(() =>
    preparationBundleKey("staging", undefined, "../123", digest),
  );
});

test("handoff readback failure and oversized reads fail before providing build inputs", async () => {
  const target = { mode: "staging", run: "123-1", codeSha: sha },
    bundle = {
      version: 1,
      target: "staging",
      run: target.run,
      codeSha: sha,
      ...values(),
    },
    store = memoryStore();
  const get = store.get;
  store.get = async (key) =>
    store.writes.length ? Buffer.from("corrupt readback") : get(key);
  await assert.rejects(
    uploadPreparationBundle(store, bundle, target),
    /checksum/,
  );
  await assert.rejects(
    downloadPreparationBundle(
      { get: async () => ({ byteLength: 64 * 1024 * 1024 + 1 }) },
      digest,
      target,
    ),
    /checksum/,
  );
});
