import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  stat,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  prepareHostedTarget,
  preparationCode,
  readPrivatePreparation,
} from "./prepare-obsidian-target.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";

const sha = "a".repeat(40),
  oldRevision = "b".repeat(64),
  freshRevision = "c".repeat(64),
  digest = "d".repeat(64),
  identity = "11111111-1111-1111-1111-111111111111";

async function fixture(t, mode = "staging", pr) {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-preparation-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const target = pr ? `pr/${pr}` : mode,
    state = {
      version: 1,
      mode,
      files: { "private-canary.md": { body: "private body canary" } },
    },
    previous = Buffer.from(
      JSON.stringify({
        version: 1,
        namespace: target,
        state,
        source: oldRevision,
        codeSha: sha,
        code: preparationCode(sha, mode),
        digest,
        receipt: { deployment: identity },
      }),
    ),
    objects = new Map([[`accepted/${target}/current.json`, previous]]),
    trace = [];
  const store = {
    get: async (key) => {
      trace.push(`read:${key}`);
      return objects.get(key);
    },
    put: async (key, bytes) => {
      trace.push(`write:${key}`);
      objects.set(key, bytes);
    },
  };
  const serving = {
    identity: async () => {
      trace.push("identity");
      return identity;
    },
  };
  const execute = async (command, args, options) => {
    trace.push(command);
    assert.equal(options.cwd, cwd);
    if (command === "git") {
      assert.equal(options.purpose, "build");
      return { stdout: `${sha}\n` };
    }
    assert.equal(command, "go");
    const flag = (name) => args[args.indexOf(name) + 1],
      fallback = args.includes("--accepted-only"),
      source = fallback ? oldRevision : freshRevision,
      prepared = {
        version: 1,
        mode,
        revision: source,
        digest,
        state: { ...state, revision: source },
        entries: [{ privateTitle: "private title canary" }],
        images: {},
      },
      report = {
        version: 1,
        mode,
        source,
        digest,
        files: [{ path: "private-canary.md" }],
        masks: [],
        issues: fallback
          ? [{ key: `${source}:source_degraded`, category: "source_degraded" }]
          : [],
      };
    assert.equal(options.purpose, fallback ? "build" : "prepare");
    if (!args.includes("--bootstrap"))
      assert.deepEqual(
        await readPrivatePreparation(flag("--state"), cwd),
        state,
      );
    await saveProtectedReport(flag("--out"), prepared, cwd);
    await saveProtectedReport(flag("--report-out"), report, cwd);
    if (!fallback)
      await saveProtectedReport(
        flag("--source-out"),
        { revision: source },
        cwd,
      );
    return {
      stdout: "private renderer output canary",
      stderr: "private diagnostic canary",
    };
  };
  return {
    cwd,
    mode,
    pr,
    target,
    state,
    previous,
    objects,
    trace,
    store,
    serving,
    execute,
  };
}

test("hosted preparation reads target state before current source, pins one revision, and exposes only safe counts", async (t) => {
  for (const [mode, pr] of [["production"], ["staging"], ["preview", 403]]) {
    const env = await fixture(t, mode, pr),
      result = await prepareHostedTarget({ ...env, codeSha: sha });
    assert.equal(result.source, freshRevision);
    assert.equal(result.decision, "candidate");
    assert.equal(result.posts, 1);
    assert.deepEqual(env.trace, [
      "git",
      `read:journals/${env.target}/pending.json`,
      `read:accepted/${env.target}/current.json`,
      "identity",
      "go",
    ]);
    assert.equal(
      env.objects.get(`accepted/${env.target}/current.json`),
      env.previous,
    );
    for (const secret of [
      "private-canary",
      "private body",
      "private title",
      "renderer",
      "diagnostic canary",
    ])
      assert.equal(JSON.stringify(result).includes(secret), false);
    const path = `.obsidian-publish/hosted/${env.target}/candidate.json`,
      candidate = await readPrivatePreparation(path, env.cwd);
    assert.equal(candidate.codeSha, sha);
    assert.equal(candidate.state.mode, mode);
    assert.equal(candidate.verification.prepared.revision, result.source);
    assert.equal(candidate.artifact, undefined);
    assert.equal((await stat(join(env.cwd, path))).mode & 0o777, 0o600);
  }
});

test("content source outage retains accepted serving state while code builds prepare isolated fallback", async (t) => {
  for (const kind of ["content", "site"]) {
    const env = await fixture(t),
      execute = async (command, args, options) => {
        if (command === "go" && args.includes("--r2")) {
          env.trace.push("source-failed");
          throw new Error("private transport credential canary");
        }
        return env.execute(command, args, options);
      };
    const result = await prepareHostedTarget({ ...env, kind, execute });
    assert.equal(result.sourceAvailable, false);
    assert.equal(
      result.decision,
      kind === "content" ? "retain-serving" : "candidate",
    );
    assert.equal(
      env.objects.get("accepted/staging/current.json"),
      env.previous,
    );
    if (kind === "content") {
      const report = JSON.parse(env.objects.get("reports/staging.json"));
      assert.equal(report.status, "degraded");
      assert.equal(report.receipt, undefined);
      assert.equal(report.issues[0].category, "source_degraded");
      assert.equal(
        JSON.stringify(report).includes("private body canary"),
        false,
      );
    } else assert.equal(env.objects.has("reports/staging.json"), false);
    assert.equal(JSON.stringify(result).includes("canary"), false);
  }
});

test("missing or mismatched installed state, journal failures, stale code, and invalid targets stop before source reads", async (t) => {
  for (const change of [
    "missing",
    "wrong-mode",
    "wrong-identity",
    "journal-failed",
    "stale-code",
  ]) {
    const env = await fixture(t);
    let codeSha = sha;
    if (change === "missing")
      env.objects.delete("accepted/staging/current.json");
    if (["wrong-mode", "wrong-identity"].includes(change)) {
      const previous = JSON.parse(env.previous);
      if (change === "wrong-mode") previous.state.mode = "production";
      else previous.receipt.deployment = "other-version";
      env.objects.set(
        "accepted/staging/current.json",
        Buffer.from(JSON.stringify(previous)),
      );
    }
    if (change === "journal-failed")
      env.store.get = async () => {
        throw new Error("Unreachable private state");
      };
    if (change === "stale-code") codeSha = "f".repeat(40);
    await assert.rejects(prepareHostedTarget({ ...env, codeSha }));
    assert.equal(env.trace.includes("go"), false);
  }
  const env = await fixture(t);
  for (const input of [
    { kind: "content", bootstrap: true },
    { mode: "local" },
    { kind: "preview" },
    { account: "other account" },
    { bootstrap: true },
  ])
    await assert.rejects(prepareHostedTarget({ ...env, ...input }));
  assert.equal(env.trace.includes("go"), false);
});

test("explicit bootstrap still requires source; private read and output links cannot escape ignored storage", async (t) => {
  const env = await fixture(t);
  env.objects.clear();
  const result = await prepareHostedTarget({ ...env, bootstrap: true });
  assert.equal(result.sourceAvailable, true);
  assert.equal(env.objects.size, 0);
  env.objects.clear();
  await assert.rejects(
    prepareHostedTarget({
      ...env,
      bootstrap: true,
      execute: async (command, args, options) => {
        if (command === "go") throw new Error("Unavailable initial source");
        return env.execute(command, args, options);
      },
    }),
    /Initial private source/,
  );
  assert.equal(env.objects.size, 0);
  const outside = join(env.cwd, "outside.json");
  await writeFile(outside, '{"secret":"canary"}');
  const path = `.obsidian-publish/hosted/staging/candidate.json`;
  await rm(join(env.cwd, path));
  await symlink(outside, join(env.cwd, path));
  await assert.rejects(readPrivatePreparation(path, env.cwd), /ignored/);
  await assert.rejects(
    prepareHostedTarget({ ...env, bootstrap: true }),
    /Linked/,
  );
  assert.equal(await readFile(outside, "utf8"), '{"secret":"canary"}');
  assert.notEqual(
    preparationCode(sha, "production"),
    preparationCode(sha, "staging"),
  );
  assert.throws(() => preparationCode("bad", "production"));
});
