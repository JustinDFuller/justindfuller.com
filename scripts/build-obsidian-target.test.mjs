import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPublicationTarget,
  testedArtifactKey,
} from "./build-obsidian-target.mjs";
import {
  uploadPreparationBundle,
  downloadPreparationBundle,
} from "./obsidian-pipeline.mjs";
import { preparationCode } from "./prepare-obsidian-target.mjs";
import {
  createPublicationArchive,
  archiveChecksum,
  inspectPublicationArchive,
} from "./obsidian-archive.mjs";
import {
  compilePrivateWorker,
  validatePrivateWorkerArchive,
} from "./obsidian-worker.mjs";
import { downloadPrivateBuildInput } from "./download-obsidian-build.mjs";
import { uploadPrivateBuild } from "./upload-obsidian-build.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { validateBuiltArtifact } from "./build-obsidian-target.mjs";

const sha = "a".repeat(40),
  source = "b".repeat(64),
  digest = "c".repeat(64),
  account = "d".repeat(32);
async function fixture(t, mode = "staging", fault) {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-build-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const pr = mode === "preview" ? 403 : undefined,
    run = "123-1",
    namespace = pr ? `pr/${pr}` : mode,
    objects = new Map(),
    writes = [],
    trace = [],
    store = {
      get: async (key) => objects.get(key),
      put: async (key, bytes, immutable) => {
        writes.push({ key, immutable });
        objects.set(key, Buffer.from(bytes));
      },
    },
    state = {
      version: 1,
      mode,
      revision: source,
      files: { "private-canary.md": "private source body" },
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
      code: preparationCode(sha, mode),
      codeSha: sha,
      digest,
      state,
      verification: { prepared },
    },
    bundle = {
      version: 1,
      target: namespace,
      run,
      codeSha: sha,
      candidate,
      diagnostics: { version: 1, mode, source, digest, files: [], issues: [] },
    },
    target = { mode, pr, run, codeSha: sha };
  const handoff = await uploadPreparationBundle(store, bundle, target);
  writes.length = 0;
  const put = async (path, body) => {
    const file = join(cwd, path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, body);
  };
  let checks = 0;
  const execute = async (command, args, options) => {
    assert.equal(options.purpose, "build");
    assert.equal(options.cwd, cwd);
    trace.push(command);
    if (command === "git") {
      checks++;
      return {
        stdout: `${fault === "checkout" || (fault === "changed-code" && checks > 1) ? "9".repeat(40) : sha}\n`,
      };
    }
    if (command === "npx") {
      assert.deepEqual(args, [
        "cf",
        "deploy",
        "--prebuilt",
        "--mode",
        mode,
        "--dry-run",
      ]);
      if (fault === "dry-run") throw Error("private cf output");
      return { stdout: "private diagnostics" };
    }
    assert.equal(command, "npm");
    assert.deepEqual(args.slice(0, 3), ["run", "build:cloudflare", "--"]);
    if (fault === "build") throw Error("private render output");
    const publication = args[args.indexOf("--publication-id") + 1],
      marker = JSON.stringify({
        version: 1,
        publication: fault === "marker" ? "0".repeat(64) : publication,
      }),
      root = ".cloudflare/output/v0/workers/default/";
    for (const prefix of ["dist/", `${root}assets/`]) {
      await put(`${prefix}__publication.json`, marker);
      await put(
        `${prefix}index.html`,
        prefix === "dist/" || fault !== "asset"
          ? "rendered body canary"
          : "corrupt asset",
      );
    }
    if (fault === "extra-asset")
      await put(`${root}assets/private-source.json`, "raw private canary");
    await put(
      ".cloudflare/site-manifest.json",
      JSON.stringify({ pages: ["/"], assets: ["/__publication.json"] }),
    );
    await put(
      ".cloudflare/output/v0/config.json",
      JSON.stringify({
        accountId: account,
        buildContext: {
          mode: fault === "mode" ? "production" : mode,
          isPreview: mode === "preview",
        },
      }),
    );
    await put(
      `${root}worker.config.json`,
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
        env:
          mode === "production"
            ? {}
            : {
                ASSETS: { type: "assets" },
                OBSIDIAN_SOURCE: {
                  type: "r2",
                  name:
                    fault === "binding"
                      ? "justindfuller-obsidian-state"
                      : "justindfuller-obsidian-source",
                },
              },
      }),
    );
    if (mode !== "production") {
      await put(
        `${root}bundle/private.js`,
        "export default {async fetch(req, env) { const page = await env.OBSIDIAN_SOURCE.list(); return new Response(await (await env.OBSIDIAN_SOURCE.get(page.objects[0].key)).text()); }}",
      );
      await put(`${root}bundle/extra.js`, 'export default "untrusted";');
    }
    return { stdout: "private build output" };
  };
  return {
    cwd,
    store,
    mode,
    pr,
    run,
    codeSha: sha,
    preparation: handoff.checksum,
    account,
    execute,
    writes,
    trace,
    target,
    objects,
  };
}

test("build job reads an exact preparation and hands off only the validated checksummed tested artifact", async (t) => {
  for (const mode of ["production", "staging", "preview"]) {
    const f = await fixture(t, mode),
      result = await buildPublicationTarget(f);
    assert.equal(result.status, "built");
    assert.equal(result.codeSha, sha);
    assert.deepEqual(
      f.trace,
      mode === "preview" ? ["git", "npm", "git"] : ["git", "npm", "npx", "git"],
    );
    const tested = await downloadPreparationBundle(
      f.store,
      result.handoff.checksum,
      f.target,
    );
    assert.equal(tested.candidate.artifact, result.artifact);
    assert.equal(
      tested.testedArtifact.key,
      testedArtifactKey(mode, f.pr, f.run, result.artifact),
    );
    assert.ok(
      tested.candidate.archive.startsWith(
        `rollback/artifacts/${result.target}/`,
      ),
    );
    assert.equal(
      tested.candidate.verification.marker.path,
      "/__publication.json",
    );
    assert.equal(
      tested.candidate.verification.prepared.state.files["private-canary.md"],
      "private source body",
    );
    assert.equal(f.writes.length, 2);
    assert.ok(f.writes.every((write) => write.immutable));
    assert.ok(!JSON.stringify(result).includes("canary"));
    if (mode !== "production") {
      const compiled = await compilePrivateWorker({
          account,
          mode,
          images: {},
        }),
        archive = f.objects.get(tested.testedArtifact.key);
      assert.deepEqual(
        validatePrivateWorkerArchive(archive, result.artifact, compiled),
        tested.candidate.verification.worker,
      );
      assert.equal(
        inspectPublicationArchive(archive, result.artifact).some((entry) =>
          entry.bytes.toString().includes("OBSIDIAN_SOURCE.list()"),
        ),
        false,
      );
    } else assert.equal(tested.candidate.verification.worker, undefined);
    assert.ok(
      !f.writes.some(
        (write) =>
          write.key.startsWith("accepted/") ||
          write.key.startsWith("journals/"),
      ),
    );
  }
});

test("credentialed uploader replaces hostile rendered runtime with independently compiled control code", async (t) => {
  const f = await fixture(t, "preview");
  await buildPublicationTarget(f);
  const input = await downloadPrivateBuildInput(f),
    bytes = createPublicationArchive(f.cwd),
    checksum = archiveChecksum(bytes),
    marker = validateBuiltArtifact(bytes, checksum, {
      account,
      mode: f.mode,
      publication: input.publication,
    }),
    rendered = {
      version: 1,
      target: "pr/403",
      run: f.run,
      codeSha: f.codeSha,
      preparation: f.preparation,
      publication: input.publication,
      checksum,
      bytes: bytes.length,
      marker,
    };
  await saveProtectedReport(
    ".obsidian-publish/hosted/pr/403/rendered.json",
    rendered,
    f.cwd,
  );
  await saveProtectedReport(
    ".obsidian-publish/hosted/pr/403/rendered.tar",
    { bytes: bytes.toString("base64") },
    f.cwd,
  );
  const uploaded = await uploadPrivateBuild(f),
    tested = await downloadPreparationBundle(
      f.store,
      uploaded.handoff.checksum,
      f.target,
    ),
    compiled = await compilePrivateWorker({
      account,
      mode: f.mode,
      images: {},
    });
  assert.notEqual(uploaded.checksum, checksum);
  assert.deepEqual(
    validatePrivateWorkerArchive(
      f.objects.get(tested.testedArtifact.key),
      uploaded.checksum,
      compiled,
    ),
    tested.candidate.verification.worker,
  );
});

test("wrong checkout, render/dry-run failures, marker/config/asset mismatch never create tested handoffs", async (t) => {
  for (const fault of [
    "checkout",
    "build",
    "dry-run",
    "changed-code",
    "marker",
    "mode",
    "asset",
    "extra-asset",
    "binding",
  ]) {
    const f = await fixture(t, "staging", fault);
    await assert.rejects(buildPublicationTarget(f));
    assert.deepEqual(f.writes, [], fault);
  }
});

test("failed tested-archive readback cannot provide a deployment handoff", async (t) => {
  const f = await fixture(t),
    get = f.store.get;
  f.store.get = async (key) =>
    key.startsWith("rollback/artifacts/") && f.writes.length
      ? Buffer.from("corrupt")
      : get(key);
  await assert.rejects(buildPublicationTarget(f), /checksum/);
  assert.equal(
    f.writes.some((write) => write.key.startsWith("candidates/")),
    false,
  );
  assert.throws(() => testedArtifactKey("local", undefined, "123", digest));
  assert.throws(() =>
    testedArtifactKey("staging", undefined, "../../reports", digest),
  );
});
