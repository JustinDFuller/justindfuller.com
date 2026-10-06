import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  realpath,
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
  runPreparationCommand,
} from "./prepare-obsidian-target.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";

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
      explicitPinned = args.includes("--source"),
      source = fallback
        ? oldRevision
        : explicitPinned
          ? (await readPrivatePreparation(flag("--source"), cwd)).revision
          : freshRevision,
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
    assert.equal(
      options.purpose,
      fallback || explicitPinned ? "build" : "prepare",
    );
    if (!args.includes("--bootstrap"))
      assert.deepEqual(
        await readPrivatePreparation(flag("--state"), cwd),
        state,
      );
    await saveProtectedReport(flag("--out"), prepared, cwd);
    await saveProtectedReport(flag("--report-out"), report, cwd);
    if (!fallback && !explicitPinned)
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
  const pinnedSource = `.obsidian-publish/hosted/${target}/pinned.json`;
  await saveProtectedReport(
    pinnedSource,
    {
      revision: freshRevision,
      snapshot: { version: 1, files: {}, images: {} },
      bodies: {},
      ready: {},
    },
    cwd,
  );
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
    pinnedSource,
  };
}

test("hosted preparation reads target state before current source, pins one revision, and exposes only safe counts", async (t) => {
  for (const [mode, pr] of [["production"], ["staging"], ["preview", 403]]) {
    const env = await fixture(t, mode, pr),
      result = await prepareHostedTarget({
        ...env,
        codeSha: sha,
        pinnedSource: env.pinnedSource,
      });
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

test("explicit content source outage retains accepted serving state while code builds prepare isolated fallback", async (t) => {
  for (const kind of ["content", "site"]) {
    const env = await fixture(t),
      result = await prepareHostedTarget({
        ...env,
        kind,
        pinnedSource: undefined,
        sourceUnavailable: true,
      });
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

test("explicit pinned source is copied privately and prepared without source credentials", async (t) => {
  const env = await fixture(t),
    pinned = await readPrivatePreparation(env.pinnedSource, env.cwd),
    input = env.pinnedSource;
  const result = await prepareHostedTarget({
    ...env,
    codeSha: sha,
    pinnedSource: input,
  });
  assert.equal(result.source, freshRevision);
  assert.equal(result.sourceAvailable, true);
  assert.equal(env.trace.filter((item) => item === "go").length, 1);
  const args = [];
  let purpose;
  const execute = async (command, values, options) => {
    if (command === "go") {
      args.push(...values);
      purpose = options.purpose;
    }
    return env.execute(command, values, options);
  };
  await prepareHostedTarget({
    ...env,
    codeSha: sha,
    pinnedSource: input,
    execute,
  });
  assert.equal(purpose, "build");
  assert.ok(args.includes("--source"));
  assert.ok(!args.includes("--r2"));
  assert.ok(!args.includes("--source-out"));
  assert.deepEqual(
    await readPrivatePreparation(
      `.obsidian-publish/hosted/staging/pinned.json`,
      env.cwd,
    ),
    pinned,
  );
  const buildEnvironment = publicationEnvironment(
    {
      OBSIDIAN_SOURCE_ACCESS_KEY_ID: "source-key-canary",
      OBSIDIAN_SOURCE_SECRET_ACCESS_KEY: "source-secret-canary",
    },
    "build",
  );
  assert.equal("OBSIDIAN_SOURCE_ACCESS_KEY_ID" in buildEnvironment, false);
  assert.equal("OBSIDIAN_SOURCE_SECRET_ACCESS_KEY" in buildEnvironment, false);
});

test("explicit source outage requires accepted state, retains content requests, and does not catch pinned Go failures", async (t) => {
  const env = await fixture(t),
    result = await prepareHostedTarget({
      ...env,
      kind: "content",
      pinnedSource: undefined,
      sourceUnavailable: true,
    });
  assert.equal(result.sourceAvailable, false);
  assert.equal(result.decision, "retain-serving");
  assert.deepEqual(
    env.trace.filter((item) => item === "go"),
    ["go"],
  );

  const preview = await fixture(t, "preview", 403),
    pinned = {
      revision: freshRevision,
      snapshot: { version: 1, files: {}, images: {} },
      bodies: {},
      ready: {},
    },
    input = preview.pinnedSource;
  await saveProtectedReport(input, pinned, preview.cwd);
  const calls = [];
  await assert.rejects(
    prepareHostedTarget({
      ...preview,
      pinnedSource: input,
      execute: async (command, args, options) => {
        if (command === "go") {
          calls.push(args);
          throw new Error("pinned preparation failure");
        }
        return preview.execute(command, args, options);
      },
    }),
    /pinned preparation failure/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes("--accepted-only"), false);
  await assert.rejects(
    prepareHostedTarget({
      ...preview,
      pinnedSource: input,
      sourceUnavailable: true,
    }),
    /pinned source or source outage/,
  );
  const missing = await fixture(t);
  missing.objects.delete("accepted/staging/current.json");
  await assert.rejects(
    prepareHostedTarget({
      ...missing,
      pinnedSource: undefined,
      sourceUnavailable: true,
    }),
    /Installed accepted state/,
  );
  assert.equal(missing.trace.includes("go"), false);
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
    await assert.rejects(
      prepareHostedTarget({
        ...env,
        codeSha,
        pinnedSource: undefined,
        sourceUnavailable: true,
      }),
    );
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
    await assert.rejects(
      prepareHostedTarget({
        ...env,
        pinnedSource: env.pinnedSource,
        ...input,
      }),
    );
  assert.equal(env.trace.includes("go"), false);
});

test("hosted preparation requires an explicit pinned source or unavailable-source decision", async (t) => {
  const env = await fixture(t);
  await assert.rejects(
    prepareHostedTarget({ ...env, pinnedSource: undefined }),
    /pinned source or source outage/,
  );
  assert.equal(env.trace.includes("go"), false);
});

test("explicit bootstrap still requires source; private read and output links cannot escape ignored storage", async (t) => {
  const env = await fixture(t);
  env.objects.clear();
  const result = await prepareHostedTarget({
    ...env,
    bootstrap: true,
    pinnedSource: env.pinnedSource,
  });
  assert.equal(result.sourceAvailable, true);
  assert.equal(env.objects.size, 0);
  env.objects.clear();
  await assert.rejects(
    prepareHostedTarget({
      ...env,
      bootstrap: true,
      pinnedSource: env.pinnedSource,
      execute: async (command, args, options) => {
        if (command === "go") throw new Error("Unavailable initial source");
        return env.execute(command, args, options);
      },
    }),
    /Unavailable initial source/,
  );
  assert.equal(env.objects.size, 0);
  const outside = join(env.cwd, "outside.json");
  await writeFile(outside, '{"secret":"canary"}');
  const path = `.obsidian-publish/hosted/staging/candidate.json`;
  await rm(join(env.cwd, path));
  await symlink(outside, join(env.cwd, path));
  await assert.rejects(readPrivatePreparation(path, env.cwd), /ignored/);
  await assert.rejects(
    prepareHostedTarget({
      ...env,
      bootstrap: true,
      pinnedSource: env.pinnedSource,
    }),
    /Linked/,
  );
  assert.equal(await readFile(outside, "utf8"), '{"secret":"canary"}');
  assert.notEqual(
    preparationCode(sha, "production"),
    preparationCode(sha, "staging"),
  );
  assert.throws(() => preparationCode("bad", "production"));
});

test("container preparation has only a read-only module cache and offline workspace mount", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "obsidian-container-")),
    workspace = join(root, "workspace"),
    controlWorkspace = join(workspace, "control"),
    moduleCache = join(root, "gomodcache");
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all([
    mkdir(controlWorkspace, { recursive: true }),
    mkdir(moduleCache),
  ]);
  const resolvedWorkspace = await realpath(workspace),
    resolvedControlWorkspace = await realpath(controlWorkspace),
    resolvedModuleCache = await realpath(moduleCache);
  let call;
  await runPreparationCommand(
    async (...args) => {
      call = args;
      return { stdout: "", stderr: "" };
    },
    ["run", "./cmd/prepare-obsidian", "--accepted-only"],
    workspace,
    {
      OBSIDIAN_PREPARE_CONTAINER: "true",
      OBSIDIAN_PREPARE_GOMODCACHE: moduleCache,
    },
    "control",
  );
  assert.equal(call[0], "docker");
  assert.deepEqual(call[2], {
    cwd: workspace,
    purpose: "build",
  });
  assert.deepEqual(call[1].slice(0, 4), [
    "run",
    "--pull=never",
    "--rm",
    "--network=none",
  ]);
  for (const option of [
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--read-only",
    "/tmp:rw,nosuid,nodev,size=1g",
    `--user`,
    `${process.getuid()}:${process.getgid()}`,
  ])
    assert.ok(call[1].includes(option));
  assert.ok(
    call[1].includes(`type=bind,source=${resolvedWorkspace},target=/workspace`),
  );
  assert.ok(
    call[1].includes(
      `type=bind,source=${resolvedModuleCache},target=/go/pkg/mod,readonly`,
    ),
  );
  assert.ok(
    call[1].includes(
      `type=bind,source=${resolvedControlWorkspace},target=/workspace/control,readonly`,
    ),
  );
  assert.ok(
    call[1].includes(
      `/go-cache:rw,nosuid,nodev,uid=${process.getuid()},gid=${process.getgid()},size=2g`,
    ),
  );
  assert.ok(
    call[1].includes(
      `/go-run:rw,exec,nosuid,nodev,uid=${process.getuid()},gid=${process.getgid()},size=1g`,
    ),
  );
  const containerEnvironment = call[1]
    .flatMap((argument, index) =>
      argument === "--env" ? [call[1][index + 1]] : [],
    )
    .sort();
  assert.deepEqual(containerEnvironment, [
    "GOCACHE=/go-cache",
    "GOMODCACHE=/go/pkg/mod",
    "GOTMPDIR=/go-run",
  ]);
  assert.equal(call[1].includes("/var/run/docker.sock"), false);
  assert.ok(call[1].includes("GOCACHE=/go-cache"));
  assert.equal(call[1].includes("OBSIDIAN_SOURCE_SECRET_ACCESS_KEY"), false);
  assert.deepEqual(call[1].slice(-4), [
    "go",
    "run",
    "./cmd/prepare-obsidian",
    "--accepted-only",
  ]);
});

test("container preparation fails closed without a detached module cache", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "obsidian-container-")),
    workspace = join(root, "workspace");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(workspace);
  let calls = 0;
  await assert.rejects(
    runPreparationCommand(
      async () => {
        calls++;
      },
      ["run"],
      workspace,
      { OBSIDIAN_PREPARE_CONTAINER: "true" },
    ),
    /module cache is unavailable/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    runPreparationCommand(
      async () => {
        calls++;
      },
      ["run"],
      workspace,
      { OBSIDIAN_PREPARE_CONTAINER: "false" },
    ),
    /container is required/,
  );
  assert.equal(calls, 0);
});
