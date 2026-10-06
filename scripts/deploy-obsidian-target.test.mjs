import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployPublicationTarget } from "./deploy-obsidian-target.mjs";
import {
  artifactPublication,
  testedArtifactKey,
} from "./build-obsidian-target.mjs";
import {
  createPublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";
import { uploadPreparationBundle } from "./obsidian-pipeline.mjs";
import { preparationCode } from "./prepare-obsidian-target.mjs";
import { publicationRepository } from "./obsidian-workflow.mjs";
import { compilePrivateWorker } from "./obsidian-worker.mjs";

async function fixture(t, mode = "staging") {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-deploy-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const account = "a".repeat(32),
    codeSha = "b".repeat(40),
    source = "c".repeat(64),
    digest = "d".repeat(64),
    run = "123-2",
    pr = mode === "preview" ? 403 : undefined,
    namespace = pr ? `pr/${pr}` : mode,
    state = {
      version: 1,
      mode,
      revision: source,
      files: { "private-canary.md": "private body canary" },
    },
    prepared = {
      version: 1,
      mode,
      revision: source,
      digest,
      state,
      entries: [],
      images: {},
    },
    candidate = {
      source,
      digest,
      codeSha,
      code: preparationCode(codeSha, mode),
      state,
      verification: { prepared },
    },
    publication = artifactPublication(namespace, run, candidate),
    marker = Buffer.from(JSON.stringify({ version: 1, publication })),
    objects = new Map(),
    writes = [],
    trace = [],
    store = {
      counters: {},
      get: async (key) => objects.get(key),
      put: async (key, bytes, immutable) => {
        writes.push({ key, immutable });
        objects.set(key, Buffer.from(bytes));
      },
    },
    put = async (path, bytes) => {
      const file = join(cwd, path);
      await mkdir(join(file, ".."), { recursive: true });
      await writeFile(
        file,
        typeof bytes === "object" && !Buffer.isBuffer(bytes)
          ? JSON.stringify(bytes)
          : bytes,
      );
    },
    root = ".cloudflare/output/v0/workers/default/";
  for (const prefix of ["dist/", `${root}assets/`]) {
    await put(`${prefix}__publication.json`, marker);
    await put(`${prefix}index.html`, "rendered canary");
  }
  await put(".cloudflare/site-manifest.json", { pages: ["/"], assets: [] });
  await put(".cloudflare/output/v0/config.json", {
    accountId: account,
    buildContext: { mode, isPreview: mode === "preview" },
  });
  await put(`${root}worker.config.json`, {
    name:
      mode === "staging" ? "justindfuller-site-staging" : "justindfuller-site",
    workersDev: mode === "preview",
    previewUrls: mode !== "staging",
    domains:
      mode === "production"
        ? ["justindfuller.com", "www.justindfuller.com"]
        : mode === "staging"
          ? ["staging.justindfuller.com"]
          : [],
    env:
      mode === "production"
        ? {}
        : {
            ASSETS: { type: "assets" },
            OBSIDIAN_SOURCE: {
              type: "r2",
              name: "justindfuller-obsidian-source",
            },
          },
  });
  if (mode !== "production") {
    const compiled = await compilePrivateWorker({ account, mode, images: {} });
    await put(`${root}worker.config.json`, compiled.configBytes);
    await put(`${root}bundle/private.js`, compiled.moduleBytes);
    await put(".cloudflare/output/v0/config.json", compiled.outputConfigBytes);
    candidate.verification.worker = compiled.attestation;
  }
  const bytes = createPublicationArchive(cwd),
    artifact = archiveChecksum(bytes);
  Object.assign(candidate, {
    artifact,
    archive: `rollback/artifacts/${namespace}/${artifact}.tar`,
    verification: {
      ...candidate.verification,
      marker: {
        path: "/__publication.json",
        size: marker.length,
        sha256: archiveChecksum(marker),
      },
    },
  });
  const bundle = {
      version: 1,
      target: namespace,
      run,
      codeSha,
      candidate,
      diagnostics: { version: 1, mode, source, digest, files: [], issues: [] },
      testedArtifact: {
        key: testedArtifactKey(mode, pr, run, artifact),
        checksum: artifact,
        bytes: bytes.length,
      },
    },
    target = { mode, pr, run, codeSha };
  objects.set(bundle.testedArtifact.key, bytes);
  const handoff = await uploadPreparationBundle(store, bundle, target);
  writes.length = 0;
  let live = "11111111-1111-1111-1111-111111111111";
  const serving = {
    mode,
    pr,
    account,
    counters: {},
    identity: async () => live,
    capture: async () => ({
      deployment: live,
      artifact: "f".repeat(64),
      archive: "rollback/prior.tar",
      verification: {},
    }),
    verify: async (receipt) => {
      trace.push("verify");
      assert.equal(receipt.deployment, live);
    },
    deploy: async (receipt) => {
      trace.push("deploy");
      assert.deepEqual(objects.get(receipt.archive), bytes);
      live = "22222222-2222-2222-2222-222222222222";
      return live;
    },
    rollback: async (identity) => {
      trace.push("rollback");
      live = identity;
    },
  };
  return {
    cwd,
    account,
    ...target,
    preparation: handoff.checksum,
    bootstrap: true,
    store,
    serving,
    bundle,
    bytes,
    objects,
    writes,
    trace,
    target,
    execute: async () => ({ stdout: codeSha }),
    github: {
      pull: async () => ({
        number: pr,
        state: "open",
        head: { sha: codeSha, repo: { full_name: publicationRepository } },
        base: { repo: { full_name: publicationRepository } },
        user: { login: "owner" },
      }),
    },
  };
}

test("exact tested archives are retained before publication and accepted only after verification in every target", async (t) => {
  for (const mode of ["production", "staging", "preview"]) {
    const f = await fixture(t, mode),
      receipt = await deployPublicationTarget(f);
    assert.equal(receipt.run, f.run);
    assert.equal(receipt.artifact, f.bundle.candidate.artifact);
    assert.equal(receipt.target, f.bundle.target);
    assert.deepEqual(f.objects.get(f.bundle.candidate.archive), f.bytes);
    assert.equal(
      f.writes.some((write) => write.key === f.bundle.candidate.archive),
      false,
    );
    const accepted = JSON.parse(
      f.objects.get(`accepted/${f.bundle.target}/current.json`),
    );
    assert.equal(accepted.receipt.deployment, receipt.deployment);
    assert.deepEqual(f.trace, ["verify", "deploy", "verify"]);
    assert.equal(JSON.stringify(receipt).includes("canary"), false);
    assert.ok(
      f.writes.every(
        (write) =>
          !write.key.includes(mode === "production" ? "staging" : "production"),
      ),
    );
  }
});

test("cross-target, corrupt, mismatched, changed-code and closed-preview handoffs cannot deploy or accept", async (t) => {
  for (const fault of [
    "authority",
    "checkout",
    "changed-code",
    "key",
    "checksum",
    "size",
    "archive",
    "marker",
    "bytes",
    "retained",
    "readback",
    "closed-pr",
    "changed-pr",
    "worker-proof",
    "worker-missing",
    "worker-allowlist",
    "worker-runtime",
    "worker-extra",
    "worker-config",
  ]) {
    const f = await fixture(t, fault.endsWith("pr") ? "preview" : "staging");
    if (fault === "authority") f.serving.mode = "production";
    if (fault === "checkout")
      f.execute = async () => ({ stdout: "9".repeat(40) });
    if (fault === "changed-code") {
      let reads = 0;
      f.execute = async () => ({
        stdout: ++reads === 1 ? f.codeSha : "9".repeat(40),
      });
    }
    if (fault === "key")
      f.bundle.testedArtifact.key = f.bundle.testedArtifact.key.replace(
        "staging",
        "production",
      );
    if (fault === "checksum") f.bundle.testedArtifact.checksum = "0".repeat(64);
    if (fault === "size") f.bundle.testedArtifact.bytes++;
    if (fault === "archive")
      f.bundle.candidate.archive = "rollback/artifacts/production/stolen.tar";
    if (fault === "marker")
      f.bundle.candidate.verification.marker.sha256 = "0".repeat(64);
    if (fault === "worker-proof")
      f.bundle.candidate.verification.worker.moduleHash = "0".repeat(64);
    if (fault === "worker-missing")
      delete f.bundle.candidate.verification.worker;
    if (fault === "worker-allowlist")
      f.bundle.candidate.verification.prepared.images = {
        [`v1/${"e".repeat(64)}.jpg`]: {
          key: `v1/${"e".repeat(64)}.jpg`,
          sha256: "e".repeat(64),
          md5: "f".repeat(32),
          size: 12,
          contentType: "image/jpeg",
        },
      };
    if (["worker-runtime", "worker-extra", "worker-config"].includes(fault)) {
      const root = join(f.cwd, ".cloudflare/output/v0/workers/default");
      if (fault === "worker-runtime") {
        const malicious = Buffer.from(
          "export default {async fetch(req, env) {return new Response(JSON.stringify(await env.OBSIDIAN_SOURCE.list()));}}",
        );
        await writeFile(join(root, "bundle/private.js"), malicious);
        f.bundle.candidate.verification.worker.moduleHash =
          archiveChecksum(malicious);
      } else if (fault === "worker-extra")
        await writeFile(
          join(root, "bundle/extra.js"),
          'export default "untrusted";',
        );
      else {
        const config = JSON.parse(
          await readFile(join(root, "worker.config.json"), "utf8"),
        );
        config.compatibilityDate = "2025-01-01";
        const bytes = Buffer.from(JSON.stringify(config));
        await writeFile(join(root, "worker.config.json"), bytes);
        f.bundle.candidate.verification.worker.configHash =
          archiveChecksum(bytes);
      }
      const bytes = createPublicationArchive(f.cwd),
        checksum = archiveChecksum(bytes);
      f.bundle.candidate.artifact = checksum;
      f.bundle.candidate.archive = `rollback/artifacts/${f.bundle.target}/${checksum}.tar`;
      f.bundle.testedArtifact = {
        key: testedArtifactKey(f.mode, f.pr, f.run, checksum),
        checksum,
        bytes: bytes.length,
      };
      f.objects.set(f.bundle.testedArtifact.key, bytes);
    }
    if (fault === "bytes")
      f.objects.set(f.bundle.testedArtifact.key, Buffer.from("corrupt"));
    if (fault === "retained")
      f.objects.set(f.bundle.candidate.archive, Buffer.from("corrupt"));
    if (fault === "readback") {
      const get = f.store.get;
      let reads = 0;
      f.store.get = async (key) =>
        key === f.bundle.testedArtifact.key && ++reads === 2
          ? Buffer.from("corrupt")
          : get(key);
    }
    if (fault.endsWith("pr")) {
      const pull = f.github.pull;
      f.github.pull = async () => {
        const value = await pull();
        if (fault === "closed-pr") value.state = "closed";
        else value.head.sha = "9".repeat(40);
        return value;
      };
    }
    f.preparation = (
      await uploadPreparationBundle(f.store, f.bundle, f.target)
    ).checksum;
    f.writes.length = 0;
    await assert.rejects(deployPublicationTarget(f), undefined, fault);
    assert.deepEqual(f.trace, [], fault);
    if (fault.startsWith("worker-")) assert.deepEqual(f.writes, [], fault);
    assert.ok(
      !f.writes.some((write) =>
        ["accepted/", "journals/", "reports/"].some((prefix) =>
          write.key.startsWith(prefix),
        ),
      ),
      fault,
    );
  }
});

test("failed live verification restores the prior target and does not accept the candidate", async (t) => {
  const f = await fixture(t),
    verify = f.serving.verify;
  f.serving.verify = async (receipt) => {
    await verify(receipt);
    if (receipt.deployment.startsWith("222"))
      throw Error("private failure canary");
  };
  await assert.rejects(deployPublicationTarget(f), /protected target report/);
  assert.ok(f.trace.includes("rollback"));
  assert.equal(
    await f.serving.identity(),
    "11111111-1111-1111-1111-111111111111",
  );
  const journal = JSON.parse(f.objects.get("journals/staging/pending.json"));
  assert.equal(journal.phase, "rolled_back");
  assert.notEqual(
    JSON.parse(f.objects.get("accepted/staging/current.json") ?? "null")
      ?.receipt?.artifact,
    f.bundle.candidate.artifact,
  );
  assert.equal(
    JSON.parse(f.objects.get("reports/staging.json")).status,
    "failed",
  );
});

test("preview admission is required before retaining a tested artifact", async (t) => {
  const f = await fixture(t, "preview");
  f.github = undefined;
  await assert.rejects(deployPublicationTarget(f), /preview admission/);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.trace, []);
});

test("the explicit run reaches the recorder only after archive retention and preview admission", async (t) => {
  const f = await fixture(t, "preview");
  let recorded;
  f.record = async (candidate, diagnostics, options) => {
    recorded = { candidate, diagnostics, options };
    return { run: options.run };
  };
  const result = await deployPublicationTarget(f);
  assert.equal(result.run, f.run);
  assert.equal(recorded.options.run, f.run);
  assert.deepEqual(f.trace, []);
  assert.deepEqual(f.writes, []);
});

test("post-publication maintenance removes only stale archives and emits counts without private keys", async (t) => {
  const f = await fixture(t, "production"),
    stale = `rollback/artifacts/production/${"e".repeat(64)}.tar`,
    prior = `rollback/artifacts/production/${"f".repeat(64)}.tar`,
    capture = f.serving.capture,
    deleted = [];
  f.serving.capture = async (identity) => ({
    ...(await capture(identity)),
    archive: prior,
  });
  f.store.listArchives = async () => [
    { key: stale, size: 123, lastModified: "2020-01-01T00:00:00.000Z" },
    { key: prior, size: 456, lastModified: "2020-01-01T00:00:00.000Z" },
    {
      key: f.bundle.candidate.archive,
      size: f.bytes.length,
      lastModified: "2020-01-01T00:00:00.000Z",
    },
  ];
  f.store.deleteArchive = async (key) => deleted.push(key);
  const receipt = await deployPublicationTarget(f);
  assert.deepEqual(deleted, [stale]);
  assert.equal(receipt.archiveMaintenance.status, "verified");
  assert.equal(receipt.archiveMaintenance.deleteCount, 1);
  assert.equal(receipt.archiveMaintenance.deleteBytes, 123);
  assert.equal(JSON.stringify(receipt).includes("rollback/"), false);
});

test("archive cleanup failure preserves verified publication and requests maintenance separately", async (t) => {
  const f = await fixture(t, "production");
  f.store.listArchives = async () => {
    throw new Error("private credential canary");
  };
  f.store.deleteArchive = async () => assert.fail("must not delete");
  const receipt = await deployPublicationTarget(f);
  assert.equal(receipt.archiveMaintenance.status, "cleanup-required");
  assert.equal(receipt.deployment, "22222222-2222-2222-2222-222222222222");
  assert.equal(JSON.stringify(receipt).includes("canary"), false);
  assert.ok(f.objects.has("accepted/production/current.json"));
});
