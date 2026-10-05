import { readFile, appendFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  publicationRepository,
  publicationTargets,
} from "./obsidian-workflow.mjs";

export function workflowRequest(event, env) {
  if (env.GITHUB_REPOSITORY !== publicationRepository)
    throw new Error("Publication repository differs");
  return {
    repository: env.GITHUB_REPOSITORY,
    event: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    actor: env.GITHUB_ACTOR,
    pr: event.pull_request?.number,
    author: event.pull_request?.user?.login,
    headRepository: event.pull_request?.head?.repo?.full_name,
    inputs: event.inputs ?? {},
  };
}

export function publicationGitHub(token, transport = fetch) {
  if (!token) throw new Error("GitHub read authority required");
  async function read(path) {
    const response = await transport(
      `https://api.github.com/repos/${publicationRepository}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error("GitHub publication metadata unavailable");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2 * 1024 * 1024)
      throw new Error("GitHub publication metadata exceeds limit");
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  }
  return {
    main: async () => (await read("git/ref/heads/main")).object?.sha,
    pull: async (number) => {
      if (!Number.isSafeInteger(number) || number < 1)
        throw new Error("Canonical PR number required");
      return read(`pulls/${number}`);
    },
  };
}

export async function planWorkflow(event, env, github) {
  const request = workflowRequest(event, env),
    plan = await publicationTargets(request, github),
    kind =
      request.event === "pull_request"
        ? "preview"
        : request.event === "push"
          ? "site"
          : (request.inputs.publish_kind ?? "site");
  return {
    version: 1,
    kind,
    validationOnly: plan.validationOnly,
    targets: plan.targets.map((target) => ({ ...target, kind })),
  };
}

export function legacyWorkflowAllowed(plan, event, env) {
  if (plan.validationOnly) return true;
  if (env.GITHUB_EVENT_NAME === "pull_request") return true;
  return (
    plan.kind === "site" &&
    env.GITHUB_REF === "refs/heads/main" &&
    (env.GITHUB_EVENT_NAME === "push" ||
      env.GITHUB_EVENT_NAME === "workflow_dispatch") &&
    !event.inputs?.preview_pr
  );
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || (await stat(eventPath)).size > 2 * 1024 * 1024)
    throw new Error("Bounded workflow event required");
  const event = JSON.parse(await readFile(eventPath, "utf8")),
    github = publicationGitHub(process.env.GITHUB_TOKEN),
    plan = await planWorkflow(event, process.env, github);
  if (
    process.argv.includes("--legacy-guard") &&
    !legacyWorkflowAllowed(plan, event, process.env)
  )
    throw new Error(
      "Private publishing pipeline is not enabled; request was not deployed",
    );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `targets=${JSON.stringify(plan.targets)}\nvalidation_only=${plan.validationOnly}\nkind=${plan.kind}\n`,
    );
  console.log(JSON.stringify(plan));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Publication request rejected; verify main ref, request kind and eligible open PR. Private publishing requests require the completed private pipeline.",
    );
    process.exitCode = 1;
  });
