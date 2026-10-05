import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  workflowRequest,
  planWorkflow,
  publicationGitHub,
  legacyWorkflowAllowed,
} from "./plan-obsidian-workflow.mjs";

const repository = "JustinDFuller/justindfuller.com",
  sha = "a".repeat(40),
  env = {
    GITHUB_REPOSITORY: repository,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_ACTOR: "owner",
  };
const pr = {
  number: 403,
  state: "open",
  user: { login: "owner" },
  head: { sha, repo: { full_name: repository } },
  base: { repo: { full_name: repository } },
};

test("workflow admission emits independent targets while keeping content dispatch away from legacy production", async () => {
  for (const kind of ["site", "content"]) {
    const event = {
        inputs: { publish_kind: kind, source_revision: "b".repeat(64) },
      },
      plan = await planWorkflow(event, env, {});
    assert.equal(plan.kind, kind);
    assert.deepEqual(
      plan.targets.map((t) => t.concurrency),
      ["cloudflare-production", "cloudflare-staging"],
    );
    assert.equal(legacyWorkflowAllowed(plan, event, env), kind === "site");
    assert.equal(JSON.stringify(plan).includes("b".repeat(64)), false);
  }
  for (const ref of ["refs/heads/feature", "refs/tags/main", "main"]) {
    await assert.rejects(
      planWorkflow(
        { inputs: { publish_kind: "content" } },
        { ...env, GITHUB_REF: ref },
        {},
      ),
    );
  }
});

test("PR refresh is current and same-repository and cannot use legacy deployment", async () => {
  const event = { inputs: { publish_kind: "preview", preview_pr: "403" } },
    plan = await planWorkflow(event, env, {
      pull: async (number) => {
        assert.equal(number, 403);
        return pr;
      },
    });
  assert.equal(plan.targets[0].codeSha, sha);
  assert.equal(plan.targets[0].concurrency, "cloudflare-refs/pull/403/merge");
  assert.equal(legacyWorkflowAllowed(plan, event, env), false);
  await assert.rejects(
    planWorkflow(event, env, {
      pull: async () => ({ ...pr, state: "closed" }),
    }),
  );
});

test("fork and Dependabot admission never reads GitHub metadata or enables private targets", async () => {
  const noRead = {
      pull: async () => {
        throw new Error("must not read");
      },
    },
    requestEnv = {
      ...env,
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/403/merge",
    };
  for (const event of [
    {
      pull_request: {
        ...pr,
        head: { ...pr.head, repo: { full_name: "fork/site" } },
      },
    },
    { pull_request: { ...pr, user: { login: "dependabot[bot]" } } },
  ]) {
    const plan = await planWorkflow(event, requestEnv, noRead);
    assert.deepEqual(plan.targets, []);
    assert.equal(plan.validationOnly, true);
    assert.equal(legacyWorkflowAllowed(plan, event, requestEnv), true);
  }
  assert.throws(() =>
    workflowRequest({}, { ...env, GITHUB_REPOSITORY: "other/site" }),
  );
});

test("GitHub reader stays within fixed repository endpoints and suppresses raw failures", async () => {
  const requests = [],
    reader = publicationGitHub("credential-canary", async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, "Bearer credential-canary");
      return new Response(
        JSON.stringify(url.endsWith("main") ? { object: { sha } } : pr),
      );
    });
  assert.equal(await reader.main(), sha);
  assert.deepEqual(await reader.pull(403), pr);
  assert.deepEqual(requests, [
    `https://api.github.com/repos/${repository}/git/ref/heads/main`,
    `https://api.github.com/repos/${repository}/pulls/403`,
  ]);
  await assert.rejects(reader.pull("403"));
  await assert.rejects(
    publicationGitHub(
      "secret",
      async () => new Response("private diagnostic", { status: 403 }),
    ).main(),
    /metadata unavailable/,
  );
  assert.throws(() => publicationGitHub());
});

test("workflow declares content inputs and guards before dependency installation and deployment", async () => {
  const workflow = await readFile(".github/workflows/cloudflare.yml", "utf8");
  for (const field of ["publish_kind:", "source_revision:", "preview_pr:"])
    assert.ok(workflow.includes(field));
  const guard = workflow.indexOf(
    "node scripts/plan-obsidian-workflow.mjs --legacy-guard",
  );
  assert.ok(guard > 0);
  assert.ok(guard < workflow.indexOf("- run: npm ci"));
  assert.ok(guard < workflow.indexOf("Deploy tested production artifact"));
});
