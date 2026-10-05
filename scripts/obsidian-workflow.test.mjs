import { test } from "node:test";
import assert from "node:assert/strict";
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
