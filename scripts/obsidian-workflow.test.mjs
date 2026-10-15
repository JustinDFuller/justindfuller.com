import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { publicIssueOutput } from "./report-obsidian-issues.mjs";
import {
  publicationRepository,
  publicationTargets,
  resolveTargetCode,
  currentPreview,
  codeValidationChecks,
  codeValidationKey,
  codeValidationPolicy,
  readCodeValidation,
  validatePublicationCode,
} from "./obsidian-workflow.mjs";

const oldSha = "a".repeat(40),
  freshSha = "b".repeat(40),
  time = "2026-10-05T02:00:00.000Z";
const pull = (sha = freshSha) => ({
  number: 403,
  state: "open",
  merged: false,
  user: { login: "JustinDFuller" },
  head: { sha, repo: { full_name: publicationRepository } },
  base: { repo: { full_name: publicationRepository } },
});
const dispatch = (inputs = {}) => ({
  event: "workflow_dispatch",
  repository: publicationRepository,
  ref: "refs/heads/main",
  actor: "JustinDFuller",
  inputs,
});

test("site and content requests use independent boundaries and resolve main after admission", async () => {
  let sha = oldSha,
    mainReads = 0;
  const github = {
    main: async () => {
      mainReads++;
      return sha;
    },
  };
  for (const kind of ["site", "content"]) {
    const plan = await publicationTargets(
      dispatch({ publish_kind: kind, source_revision: "c".repeat(64) }),
      github,
    );
    assert.equal(plan.validationOnly, false);
    assert.equal(mainReads, kind === "site" ? 0 : 2);
    assert.deepEqual(
      plan.targets.map((target) => target.concurrency),
      ["cloudflare-production", "cloudflare-staging"],
    );
    assert.equal(JSON.stringify(plan).includes("source_revision"), false);
    assert.equal(JSON.stringify(plan).includes(oldSha), false);
    sha = freshSha;
    for (const target of plan.targets) {
      const resolved = await resolveTargetCode(target, github);
      assert.equal(resolved.codeSha, freshSha);
      assert.equal(resolved.checkoutRef, "refs/heads/main");
    }
  }
  const push = await publicationTargets(
    { ...dispatch(), event: "push" },
    github,
  );
  assert.equal(push.targets[0].kind, "site");
});

test("non-main and malformed dispatches fail before reading private or GitHub state", async () => {
  let reads = 0;
  const github = {
    main: async () => reads++,
    pull: async () => reads++,
  };
  for (const request of [
    { ...dispatch(), ref: "refs/heads/feature" },
    { ...dispatch(), ref: "refs/tags/main" },
    { ...dispatch(), repository: "other/repo" },
    { ...dispatch(), event: "pull_request_target" },
    dispatch({ publish_kind: "unknown" }),
    dispatch({ publish_kind: "content", source_revision: "private canary" }),
    dispatch({ publish_kind: "site", preview_pr: "403" }),
    dispatch({ publish_kind: "preview", preview_pr: "0403" }),
    dispatch({ publish_kind: "preview", preview_pr: "1; malicious" }),
    dispatch({ publish_kind: "preview", preview_pr: "9007199254740992" }),
    {
      ...dispatch({ publish_kind: "preview", preview_pr: "403" }),
      actor: "dependabot[bot]",
    },
  ])
    await assert.rejects(publicationTargets(request, github));
  assert.equal(reads, 0);
});

test("fork and Dependabot PRs have credential-free validation plans", async () => {
  let reads = 0;
  const event = {
    event: "pull_request",
    repository: publicationRepository,
    pr: 403,
    actor: "JustinDFuller",
    author: "JustinDFuller",
    headRepository: publicationRepository,
  };
  const github = { pull: async () => reads++ };
  for (const request of [
    { ...event, headRepository: "fork/repo" },
    { ...event, actor: "dependabot[bot]" },
    { ...event, author: "dependabot[bot]" },
  ])
    assert.deepEqual(await publicationTargets(request, github), {
      validationOnly: true,
      targets: [],
    });
  assert.equal(reads, 0);
  const plan = await publicationTargets(event, { pull: async () => pull() });
  assert.equal(plan.targets[0].codeSha, freshSha);
  assert.equal(plan.targets[0].concurrency, "cloudflare-refs/pull/403/merge");
});

test("manual preview refresh uses live head and rechecks closure, repository, author, and head before deployment", async () => {
  let pr = pull();
  const github = {
    pull: async (number) => {
      assert.equal(number, 403);
      return pr;
    },
  };
  const {
    targets: [target],
  } = await publicationTargets(
    dispatch({ publish_kind: "preview", preview_pr: "403" }),
    github,
  );
  assert.equal(target.codeSha, freshSha);
  assert.deepEqual(await resolveTargetCode(target, github), target);
  for (const value of [
    { ...pull(), state: "closed" },
    { ...pull(), merged: true },
    { ...pull(), number: 404 },
    { ...pull(), head: { ...pull().head, repo: null } },
    { ...pull(), base: { repo: { full_name: "fork/repo" } } },
    { ...pull(), user: { login: "dependabot[bot]" } },
    pull(oldSha),
  ]) {
    pr = value;
    await assert.rejects(resolveTargetCode(target, github));
  }
  pr = pull();
  await assert.rejects(resolveTargetCode({ ...target, mode: "other" }, github));
  assert.throws(() => currentPreview(pull(), undefined));
  for (const change of [
    { namespace: "production" },
    { concurrency: "cloudflare-production" },
    { checkoutRef: "refs/heads/feature" },
  ])
    await assert.rejects(
      resolveTargetCode(
        {
          mode: "staging",
          namespace: "staging",
          concurrency: "cloudflare-staging",
          checkoutRef: "refs/heads/main",
          ...change,
        },
        github,
      ),
    );
});

function memoryStore() {
  const objects = new Map();
  return {
    objects,
    get: async (key) => objects.get(key),
    put: async (key, bytes) => objects.set(key, bytes),
  };
}

test("only a complete compatible main-code receipt skips code checks and its readback omits extra fields", async () => {
  const store = memoryStore(),
    completed = [];
  const validation = await validatePublicationCode(
    store,
    { codeSha: freshSha, run: "123-1", completedAt: () => time },
    async (check) => {
      completed.push(check);
      return true;
    },
  );
  assert.equal(validation.skipped, false);
  assert.deepEqual(completed, codeValidationChecks);
  const key = codeValidationKey(freshSha);
  assert.equal(key, `receipts/code/${freshSha}/${codeValidationPolicy}.json`);
  store.objects.set(
    key,
    Buffer.from(
      JSON.stringify({
        ...validation.receipt,
        credential: "credential canary",
        body: "body canary",
      }),
    ),
  );
  const reused = await validatePublicationCode(
    store,
    { codeSha: freshSha, run: "124-1" },
    async () => assert.fail("Compatible receipt must skip code checks"),
  );
  assert.equal(reused.skipped, true);
  assert.equal(reused.receipt.run, "123-1");
  assert.equal(JSON.stringify(reused).includes("canary"), false);
  assert.equal(await readCodeValidation(store, oldSha), undefined);
  const bad = [
    { version: 2 },
    { repository: "other/repo" },
    { ref: "refs/pull/403/merge" },
    { codeSha: oldSha },
    { policy: "0".repeat(64) },
    { result: "failed" },
    { checks: codeValidationChecks.slice(0, -1) },
    { checks: [...codeValidationChecks].reverse() },
    { run: "private filename canary" },
    { completedAt: "invalid" },
  ];
  for (const extra of bad) {
    store.objects.set(
      key,
      Buffer.from(JSON.stringify({ ...validation.receipt, ...extra })),
    );
    assert.equal(await readCodeValidation(store, freshSha), undefined);
  }
  for (const bytes of [Buffer.from("not JSON"), Buffer.alloc(16 * 1024 + 1)]) {
    store.objects.set(key, bytes);
    assert.equal(await readCodeValidation(store, freshSha), undefined);
  }
});

test("concurrent validations accept the immutable compatible receipt winner", async () => {
  const objects = new Map();
  let initialReads = 0,
    releaseInitialReads;
  const initialReadBarrier = new Promise((resolve) => {
    releaseInitialReads = resolve;
  });
  const store = {
    get: async (key) => {
      if (initialReads < 2) {
        initialReads++;
        if (initialReads === 2) releaseInitialReads();
        await initialReadBarrier;
        return undefined;
      }
      return objects.get(key);
    },
    put: async (key, bytes, immutable) => {
      assert.equal(immutable, true);
      if (objects.has(key)) {
        const error = new Error("Conditional write lost");
        error.name = "PreconditionFailed";
        throw error;
      }
      objects.set(key, Buffer.from(bytes));
    },
  };
  const checks = [[], []];
  const outcomes = await Promise.all(
    [
      { run: "123-1", completedAt: time },
      { run: "124-1", completedAt: "2026-10-05T12:35:00.000Z" },
    ].map(({ run, completedAt }, index) =>
      validatePublicationCode(
        store,
        { codeSha: freshSha, run, completedAt: () => completedAt },
        async (check) => {
          checks[index].push(check);
          return true;
        },
      ),
    ),
  );
  assert.deepEqual(checks, [codeValidationChecks, codeValidationChecks]);
  assert.equal(outcomes[0].skipped, false);
  assert.equal(outcomes[1].skipped, false);
  assert.deepEqual(outcomes[0].receipt, outcomes[1].receipt);
  assert.equal(outcomes[0].receiptWinner.run, outcomes[1].receiptWinner.run);
  assert.equal(
    outcomes[0].receiptWinner.completedAt,
    outcomes[1].receiptWinner.completedAt,
  );
  assert.ok(["123-1", "124-1"].includes(outcomes[0].receipt.run));
  assert.equal(
    [outcomes[0], outcomes[1]].filter(
      (outcome) => outcome.receiptWinner.matchesAttempt,
    ).length,
    1,
  );
  assert.equal(
    [outcomes[0], outcomes[1]].filter(
      (outcome) => outcome.receiptWinner.writeSucceeded,
    ).length,
    1,
  );
});

test("an ambiguous immutable write accepts its verified winner", async () => {
  const store = memoryStore();
  const result = await validatePublicationCode(
    {
      get: store.get,
      put: async (key, bytes, immutable) => {
        assert.equal(immutable, true);
        store.objects.set(key, Buffer.from(bytes));
        throw new Error("Write response was lost");
      },
    },
    { codeSha: freshSha, run: "123-1", completedAt: () => time },
    async () => true,
  );
  assert.equal(result.receiptWinner.run, "123-1");
  assert.equal(result.receiptWinner.matchesAttempt, true);
  assert.equal(result.receiptWinner.writeSucceeded, false);
});

test("a failed code check, unavailable state, or ambiguous receipt write cannot authorize content publication", async () => {
  const store = memoryStore();
  let checked = 0;
  await assert.rejects(
    validatePublicationCode(
      store,
      { codeSha: freshSha, run: "123", completedAt: () => time },
      async () => {
        checked++;
        if (checked === 2) throw new Error("Controlled validation failure");
        return true;
      },
    ),
  );
  assert.equal(checked, 2);
  assert.equal(store.objects.size, 0);
  const unavailable = {
    get: async () => {
      throw new Error("State unavailable");
    },
  };
  await assert.rejects(
    validatePublicationCode(
      unavailable,
      { codeSha: freshSha, run: "123" },
      async () => assert.fail("Do not run or skip from unreadable state"),
    ),
    /unavailable/,
  );
  await assert.rejects(
    validatePublicationCode(
      {
        ...store,
        put: async (_key, _bytes, immutable) => {
          assert.equal(immutable, true);
        },
      },
      { codeSha: freshSha, run: "123", completedAt: () => time },
      async () => true,
    ),
    /unverified/,
  );
  let reads = 0;
  await assert.rejects(
    validatePublicationCode(
      {
        get: async () => {
          reads++;
          if (reads === 1) return undefined;
          throw new Error("State became unavailable");
        },
        put: async (_key, _bytes, immutable) => {
          assert.equal(immutable, true);
          throw new Error("Ambiguous write");
        },
      },
      { codeSha: freshSha, run: "124-2", completedAt: () => time },
      async () => true,
    ),
    /winner is unreadable/,
  );
  await assert.rejects(
    validatePublicationCode(
      {
        get: async (key) =>
          key === codeValidationKey(freshSha)
            ? Buffer.from(JSON.stringify({ version: 1, result: "passed" }))
            : undefined,
        put: async (_key, _bytes, immutable) => {
          assert.equal(immutable, true);
          throw new Error("Conditional write lost");
        },
      },
      { codeSha: freshSha, run: "124-1", completedAt: () => time },
      async () => true,
    ),
    /unverified/,
  );
  await assert.rejects(
    validatePublicationCode(
      store,
      { codeSha: freshSha, run: "123", completedAt: () => time },
      async () => false,
    ),
    /did not pass/,
  );
  assert.equal(store.objects.size, 0);
  assert.throws(() => codeValidationKey("bad"));
});

const targetWorkflow = readFileSync(
    new URL("../.github/workflows/obsidian-target.yml", import.meta.url),
    "utf8",
  ),
  callerWorkflow = readFileSync(
    new URL("../.github/workflows/cloudflare.yml", import.meta.url),
    "utf8",
  );

function jobs(text) {
  const lines = text.split("\n"),
    start = lines.indexOf("jobs:");
  assert.notEqual(start, -1);
  const found = {};
  let name;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(line);
    if (header) {
      name = header[1];
      found[name] = [];
    } else if (name) found[name].push(line);
  }
  return Object.fromEntries(
    Object.entries(found).map(([key, body]) => [key, body.join("\n")]),
  );
}

const field = (block, key) =>
  new RegExp(`^ {4}${key}:\\s*(.*)$`, "m").exec(block)?.[1];

function stepScript(block, name) {
  const lines = block.split("\n"),
    start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  assert.notEqual(start, -1);
  const run = lines.findIndex(
    (line, index) => index > start && line === "        run: |",
  );
  assert.notEqual(run, -1);
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

function concludes(block, context) {
  const condition = field(block, "if"),
    match = /^\$\{\{ (.*) \}\}$/.exec(condition);
  assert.ok(match, "conclude condition must be a single expression");
  const source = match[1]
    .replace(/!cancelled\(\)/g, "true")
    .replace(/!=/g, "!==")
    .replace(/(?<![!=])==(?!=)/g, "===")
    .replace(/inputs\.mode/g, "context.mode")
    .replace(/needs\.prepare\.result/g, "context.prepare")
    .replace(/needs\.prepare\.outputs\.blocking/g, "context.blocking");
  assert.equal(/needs\.|inputs\.|github\.|secrets\./.test(source), false);
  return new Function("context", `return (${source});`)(context);
}

test("the final job needs prepare, build and deploy and runs even when build and deploy are skipped or fail", () => {
  const block = jobs(targetWorkflow).conclude;
  assert.ok(block);
  assert.equal(field(block, "needs"), "[prepare, build, deploy]");
  const condition = field(block, "if");
  assert.match(condition, /^\$\{\{ !cancelled\(\) && /);
  assert.ok(condition.includes("needs.prepare.result == 'success'"));
  assert.ok(condition.includes("needs.prepare.outputs.blocking != '0'"));
  assert.equal(condition.includes("needs.build.result"), false);
  assert.equal(condition.includes("needs.deploy.result"), false);
  assert.equal(condition.includes("needs.build.outputs"), false);
  assert.equal(block.includes("secrets."), false);
  assert.equal(block.includes("environment:"), false);
});

test("no job waits for the final job, so valid content publishes before the run fails", () => {
  const all = jobs(targetWorkflow);
  for (const [name, block] of Object.entries(all)) {
    if (name === "conclude") continue;
    assert.equal(
      /conclude/.test(field(block, "needs") ?? ""),
      false,
      `${name} must not depend on conclude`,
    );
    assert.equal(block.includes("needs.conclude"), false);
  }
  assert.equal(
    field(all.build, "if"),
    "needs.prepare.outputs.decision == 'build-required'",
  );
  assert.equal(
    field(all.deploy, "if"),
    "needs.prepare.outputs.decision == 'build-required'",
  );
  assert.equal(field(all.deploy, "needs"), "[resolve, prepare, build]");
  assert.equal(
    /needs\.prepare\.outputs\.(blocking|categories)/.test(
      all.build + all.deploy,
    ),
    false,
  );
  const callers = jobs(callerWorkflow);
  for (const [name, block] of Object.entries(callers))
    for (const target of ["production", "staging", "private-preview"])
      assert.equal(
        new RegExp(`needs:.*\\b${target}\\b`).test(block),
        false,
        `${name} must not wait for ${target}`,
      );
});

test("the final job applies only to staging and production target runs", () => {
  const block = jobs(targetWorkflow).conclude,
    condition = field(block, "if");
  assert.ok(condition.includes("inputs.mode != 'preview'"));
  assert.equal(
    concludes(block, {
      mode: "preview",
      prepare: "success",
      blocking: "2",
    }),
    false,
  );
  for (const mode of ["staging", "production"])
    assert.equal(
      concludes(block, { mode, prepare: "success", blocking: "1" }),
      true,
    );
  const callers = jobs(callerWorkflow);
  assert.match(callers.production, /^ {6}mode: production$/m);
  assert.match(callers.staging, /^ {6}mode: staging$/m);
  assert.match(callers["private-preview"], /^ {6}mode: preview$/m);
  assert.equal(
    Object.entries(callers)
      .filter(([, body]) => body.includes("obsidian-target.yml"))
      .map(([name]) => name)
      .sort()
      .join(),
    "private-preview,production,staging",
  );
});

test("pull request checks do not include the final job and no PR path can fail on vault content", () => {
  const callers = jobs(callerWorkflow);
  assert.match(
    field(callers["private-preview"], "if"),
    /needs\.admission\.outputs\.kind == 'preview'/,
  );
  for (const target of ["production", "staging"])
    assert.match(
      field(callers[target], "if"),
      /needs\.admission\.outputs\.kind != 'preview'/,
    );
  assert.equal(
    concludes(jobs(targetWorkflow).conclude, {
      mode: "preview",
      prepare: "success",
      blocking: "5",
    }),
    false,
  );
});

test("a run whose only issue is an image that is not ready passes", () => {
  const block = jobs(targetWorkflow).conclude,
    output = publicIssueOutput({
      target: "staging",
      decision: "build-required",
      handoff: { checksum: "a".repeat(64) },
      issueSummary: {
        files: 1,
        blocking: 0,
        categories: { image_not_ready: 1 },
      },
    });
  assert.equal(output.outputs.blocking, "0");
  assert.match(output.annotation, /^::warning /);
  assert.equal(
    concludes(block, {
      mode: "staging",
      prepare: "success",
      blocking: output.outputs.blocking,
    }),
    false,
  );
  assert.equal(
    concludes(block, { mode: "staging", prepare: "success", blocking: "" }),
    false,
  );
  assert.equal(
    concludes(block, { mode: "staging", prepare: "success", blocking: "3" }),
    true,
  );
  assert.equal(
    concludes(block, {
      mode: "production",
      prepare: "success",
      blocking: "3",
    }),
    true,
  );
  assert.equal(
    concludes(block, { mode: "staging", prepare: "failure", blocking: "1" }),
    false,
  );
});

test("the final job script fails with a sanitized error annotation naming only counts and categories", () => {
  const script = stepScript(
      jobs(targetWorkflow).conclude,
      "Fail the run because content was rejected",
    ),
    run = (env) =>
      spawnSync("bash", ["-c", script], {
        encoding: "utf8",
        env: { PATH: process.env.PATH, ...env },
      });
  const failed = run({
    OBSIDIAN_TARGET: "staging",
    OBSIDIAN_BLOCKING: "2",
    OBSIDIAN_CATEGORIES: '{"markdown_metadata":1,"last_known_good":1}',
  });
  assert.equal(failed.status, 1);
  assert.match(
    failed.stdout,
    /^::error title=Obsidian content rejected::staging: 2 rejected file\(s\)/,
  );
  assert.ok(
    failed.stdout.includes('{"markdown_metadata":1,"last_known_good":1}'),
  );
  assert.equal(failed.stdout.trim().split("\n").length, 1);
  for (const blocking of ["", "0", "-1", "x", "1; echo injected"]) {
    const bad = run({
      OBSIDIAN_TARGET: "staging",
      OBSIDIAN_BLOCKING: blocking,
      OBSIDIAN_CATEGORIES: "{}",
    });
    assert.equal(bad.status, 1);
    assert.ok(bad.stdout.includes("count is unavailable"));
    assert.equal(bad.stdout.includes("injected"), false);
  }
});
