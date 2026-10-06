import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  workflowRequest,
  planWorkflow,
  publicationGitHub,
  legacyWorkflowAllowed,
  resolveWorkflowTarget,
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

test("workflow target construction locks preview head separately from trusted main", async () => {
  const control = "b".repeat(40);
  const github = { pull: async () => pr, main: async () => control };
  const preview = await resolveWorkflowTarget("preview", "403", sha, github);
  assert.equal(preview.resolved.codeSha, sha);
  assert.equal(preview.resolved.pr, 403);
  assert.equal(preview.controlSha, control);
  for (const expected of [undefined, "c".repeat(40)])
    await assert.rejects(
      resolveWorkflowTarget("preview", "403", expected, github),
    );
  for (const changed of [
    { ...pr, state: "closed" },
    { ...pr, head: { ...pr.head, sha: control } },
    { ...pr, head: { ...pr.head, repo: { full_name: "other/repo" } } },
  ])
    await assert.rejects(
      resolveWorkflowTarget("preview", "403", sha, {
        ...github,
        pull: async () => changed,
      }),
    );
  for (const mode of ["production", "staging"]) {
    const result = await resolveWorkflowTarget(mode, "-", "", github);
    assert.equal(result.resolved.codeSha, control);
    assert.equal(result.controlSha, control);
  }
});

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

test("pull request target admission uses the same eligibility rules", async () => {
  const { workflowRequest: request } =
    await import("./plan-obsidian-workflow.mjs");
  const normalized = request(
    { pull_request: pr },
    {
      ...env,
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_REF: "refs/heads/main",
    },
  );
  assert.equal(normalized.event, "pull_request");
  const plan = await planWorkflow(
    { pull_request: pr },
    {
      ...env,
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_REF: "refs/heads/main",
    },
    { pull: async () => pr },
  );
  assert.equal(plan.kind, "preview");
  assert.equal(plan.targets[0].mode, "preview");
  const forkPlan = await planWorkflow(
    {
      pull_request: {
        ...pr,
        head: { ...pr.head, repo: { full_name: "fork/site" } },
      },
    },
    {
      ...env,
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_REF: "refs/heads/main",
    },
    {
      pull: async () => {
        throw new Error("fork metadata must not be read");
      },
    },
  );
  assert.equal(forkPlan.validationOnly, true);
  assert.deepEqual(forkPlan.targets, []);
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

test("locked target resolution reads current main or rejects changed and closed PRs", async () => {
  const { resolveTargetCode } = await import("./obsidian-workflow.mjs");
  const main = await resolveTargetCode(
    {
      mode: "production",
      namespace: "production",
      concurrency: "cloudflare-production",
      checkoutRef: "refs/heads/main",
    },
    { main: async () => sha },
  );
  assert.equal(main.codeSha, sha);
  assert.equal(main.concurrency, "cloudflare-production");
  await assert.rejects(
    resolveTargetCode(
      {
        mode: "staging",
        namespace: "staging",
        concurrency: "cloudflare-production",
        checkoutRef: "refs/heads/main",
      },
      { main: async () => sha },
    ),
    /concurrency boundary/,
  );
  await assert.rejects(
    resolveTargetCode(
      {
        mode: "preview",
        pr: 403,
        namespace: "pr/403",
        concurrency: "cloudflare-refs/pull/403/merge",
        codeSha: "b".repeat(40),
      },
      { pull: async () => pr },
    ),
    /changed after validation/,
  );
  await assert.rejects(
    resolveTargetCode(
      {
        mode: "preview",
        pr: 403,
        namespace: "pr/403",
        concurrency: "cloudflare-refs/pull/403/merge",
        codeSha: sha,
      },
      { pull: async () => ({ ...pr, state: "closed" }) },
    ),
  );
});

test("workflow secret files validate target identity and create private ignored files", async () => {
  const { mkdtemp, readFile, stat, rm } = await import("node:fs/promises"),
    { tmpdir } = await import("node:os"),
    { join } = await import("node:path"),
    { writeWorkflowSecrets } =
      await import("./write-obsidian-workflow-secrets.mjs"),
    directory = await mkdtemp(join(tmpdir(), "obsidian-workflow-"));
  try {
    const output = await writeWorkflowSecrets(
      {
        target: "staging",
        accessJson: JSON.stringify({
          account: "a".repeat(32),
          application: "11111111-1111-1111-1111-111111111111",
          worker: "b".repeat(32),
          mode: "staging",
          owner: "owner@example.com",
          serviceToken: "33333333-3333-3333-3333-333333333333",
          team: "example.cloudflareaccess.com",
          hosts: ["staging.example.com"],
        }),
      },
      directory,
    );
    assert.deepEqual(JSON.parse(await readFile(output.access, "utf8")).hosts, [
      "staging.example.com",
    ]);
    assert.equal((await stat(output.access)).mode & 0o777, 0o600);
    await assert.rejects(
      writeWorkflowSecrets(
        {
          target: "staging",
          accessJson: JSON.stringify({
            account: "a".repeat(32),
            application: "11111111-1111-1111-1111-111111111111",
            worker: "22222222-2222-2222-2222-222222222222",
            mode: "staging",
            owner: "owner@example.com",
            serviceToken: "33333333-3333-3333-3333-333333333333",
            team: "example.cloudflareaccess.com",
            hosts: ["staging.example.com"],
          }),
        },
        directory,
      ),
      /Access configuration is invalid/,
    );
    await assert.rejects(
      writeWorkflowSecrets(
        { target: "preview", accessJson: JSON.stringify({ mode: "staging" }) },
        directory,
      ),
    );
    await assert.rejects(
      writeWorkflowSecrets({ target: "preview" }, directory),
      /Access configuration is required/,
    );
    await assert.rejects(
      writeWorkflowSecrets(
        {
          target: "production",
          bootstrapRequired: true,
        },
        directory,
      ),
      /verified bootstrap receipt is required/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preview recovery installs frontend tools only when rollback must deploy", async () => {
  const { previewRecoveryNeedsDeployment } =
      await import("./probe-obsidian-recovery.mjs"),
    journal = {
      namespace: "pr/403",
      phase: "deployed",
      prior: { identity: "prior" },
      candidate: { artifact: "a".repeat(64) },
    };
  assert.equal(
    await previewRecoveryNeedsDeployment(journal, "prior", async () => true),
    false,
  );
  assert.equal(
    await previewRecoveryNeedsDeployment(
      { ...journal, phase: "verified", receipt: { deployment: "live" } },
      "live",
      async () => true,
    ),
    false,
  );
  assert.equal(
    await previewRecoveryNeedsDeployment(journal, "live", async () => true),
    true,
  );
  assert.equal(
    await previewRecoveryNeedsDeployment(journal, "live", async () => false),
    false,
  );
});

test("workflow declares content inputs and guards before dependency installation and deployment", async () => {
  const workflow = await readFile(".github/workflows/cloudflare.yml", "utf8");
  for (const field of ["publish_kind:", "source_revision:", "preview_pr:"])
    assert.ok(workflow.includes(field));
  const guard = workflow.indexOf("--legacy-guard");
  assert.ok(guard > 0);
  assert.ok(guard < workflow.indexOf("- run: npm ci"));
  assert.ok(guard < workflow.indexOf("Deploy tested production artifact"));
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /vars\.OBSIDIAN_PUBLISH_ENABLED == 'true'/);
  assert.match(
    workflow,
    /github\.event_name != 'pull_request_target'.*OBSIDIAN_PUBLISH_ENABLED/,
  );
  assert.match(workflow, /vars\.OBSIDIAN_PREVIEW_ACCESS_ENABLED != 'true'/);
  assert.doesNotMatch(workflow, /secrets:\s*inherit/);
  const targetWorkflow = await readFile(
    ".github/workflows/obsidian-target.yml",
    "utf8",
  );
  for (const stage of [
    "resolve:",
    "validate:",
    "prepare:",
    "build:",
    "deploy:",
  ])
    assert.ok(targetWorkflow.includes(stage));
  assert.match(targetWorkflow, /cloudflare-refs\/pull\/\{0\}\/merge/);
  assert.match(targetWorkflow, /cancel-in-progress: false/);
  assert.doesNotMatch(targetWorkflow, /actions\/upload-artifact/);
  assert.match(targetWorkflow, /decision == 'build-required'/);
  assert.match(
    workflow,
    /github\.event_name == 'pull_request_target'.*kind == 'preview'/,
  );
  assert.match(workflow, /needs\.admission\.outputs\.kind != 'preview'/);
  assert.match(targetWorkflow, /steps\.receipt\.outputs\.reusable != 'true'/);
  assert.match(
    targetWorkflow,
    /npm ci --prefix tools\/obsidian-image-publisher/,
  );
  assert.match(targetWorkflow, /bootstrap-receipt\.json/);
  assert.match(targetWorkflow, /control_sha:/);
  assert.match(targetWorkflow, /obsidian-code-\{0\}/);
  assert.match(targetWorkflow, /golang:1\.26\.0-bookworm/);
  assert.match(targetWorkflow, /OBSIDIAN_PREPARE_CONTAINER: "true"/);
  assert.match(targetWorkflow, /--pinned-source/);
  assert.match(targetWorkflow, /source_unavailable/);
  assert.match(targetWorkflow, /control\/scripts\/upload-obsidian-build\.mjs/);
  assert.match(
    targetWorkflow,
    /Move trusted control code outside the untrusted build mount/,
  );
  assert.match(
    targetWorkflow,
    /Install trusted deployment dependencies before private handoff/,
  );
  const preparation = targetWorkflow.slice(
    targetWorkflow.indexOf("Prepare the target with pinned input"),
    targetWorkflow.indexOf("  build:"),
  );
  for (const field of ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY"]) {
    assert.ok(
      preparation.includes(
        `OBSIDIAN_SOURCE_${field}: \${{ inputs.mode == 'production' && secrets.OBSIDIAN_SOURCE_${field} || '' }}`,
      ),
    );
  }
  assert.doesNotMatch(targetWorkflow, /actions\/upload-artifact/);
});
