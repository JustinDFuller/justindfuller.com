import { createHash } from "node:crypto";

export const publicationRepository = "JustinDFuller/justindfuller.com";
const commit = /^[a-f0-9]{40}$/;
const revision = /^[a-f0-9]{64}$/;
const dependabot = "dependabot[bot]";

function previewNumber(value) {
  if (
    !/^[1-9][0-9]*$/.test(String(value ?? "")) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error("Invalid preview request");
  return Number(value);
}

export function currentPreview(pr, number) {
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    pr?.number !== number ||
    pr.state !== "open" ||
    pr.merged === true ||
    pr.head?.repo?.full_name !== publicationRepository ||
    pr.base?.repo?.full_name !== publicationRepository ||
    pr.user?.login === dependabot ||
    !commit.test(pr.head?.sha ?? "")
  )
    throw new Error("Preview is not an eligible open repository PR");
  return {
    mode: "preview",
    namespace: `pr/${number}`,
    concurrency: `cloudflare-refs/pull/${number}/merge`,
    codeSha: pr.head.sha,
    pr: number,
  };
}

export async function publicationTargets(request, github) {
  if (
    request?.repository !== publicationRepository ||
    !["push", "pull_request", "workflow_dispatch"].includes(request.event)
  )
    throw new Error("Unsupported publication request");
  if (request.event === "pull_request") {
    const number = previewNumber(request.pr);
    if (
      request.actor === dependabot ||
      request.author === dependabot ||
      request.headRepository !== publicationRepository
    )
      return { validationOnly: true, targets: [] };
    const target = currentPreview(await github.pull(number), number);
    return { validationOnly: false, targets: [target] };
  }
  const kind =
    request.event === "push"
      ? "site"
      : (request.inputs?.publish_kind ?? "site");
  if (
    request.ref !== "refs/heads/main" ||
    !["site", "content", "preview"].includes(kind) ||
    (request.inputs?.source_revision &&
      !revision.test(request.inputs.source_revision)) ||
    (kind !== "preview" && request.inputs?.preview_pr)
  )
    throw new Error("Publishing requires main and supported inputs");
  if (kind === "preview") {
    if (request.actor === dependabot)
      throw new Error("Preview refresh actor is ineligible");
    const number = previewNumber(request.inputs?.preview_pr),
      target = currentPreview(await github.pull(number), number);
    return { validationOnly: false, targets: [target] };
  }
  return {
    validationOnly: false,
    targets: ["production", "staging"].map((mode) => ({
      mode,
      namespace: mode,
      concurrency: `cloudflare-${mode}`,
      checkoutRef: "refs/heads/main",
      kind,
    })),
  };
}

export async function resolveTargetCode(target, github) {
  if (["production", "staging"].includes(target?.mode)) {
    if (
      target.namespace !== target.mode ||
      target.checkoutRef !== "refs/heads/main" ||
      target.concurrency !== `cloudflare-${target.mode}`
    )
      throw new Error("Invalid target concurrency boundary");
    const codeSha = await github.main();
    if (!commit.test(codeSha ?? ""))
      throw new Error("Current main commit is unavailable");
    return { ...target, codeSha };
  }
  if (target?.mode !== "preview") throw new Error("Invalid publication target");
  const fresh = currentPreview(await github.pull(target.pr), target.pr);
  if (
    fresh.codeSha !== target.codeSha ||
    fresh.namespace !== target.namespace ||
    fresh.concurrency !== target.concurrency
  )
    throw new Error("Preview changed after validation");
  return fresh;
}

export const codeValidationChecks = Object.freeze([
  "go-tests",
  "node-tests",
  "publisher-types",
  "script-lint",
  "production-export",
  "production-dry-run",
  "staging-export",
  "staging-dry-run",
]);
export const codeValidationPolicy = createHash("sha256")
  .update(
    JSON.stringify({
      version: 1,
      policyVersion: 1,
      workflow: "cloudflare.yml",
      checks: codeValidationChecks,
    }),
  )
  .digest("hex");

export function codeValidationKey(codeSha) {
  if (!commit.test(codeSha ?? ""))
    throw new Error("Exact code commit required");
  return `receipts/code/${codeSha}/${codeValidationPolicy}.json`;
}

export async function readCodeValidation(store, codeSha) {
  const bytes = await store.get(codeValidationKey(codeSha), 16 * 1024);
  if (!bytes) return undefined;
  let value;
  try {
    if (bytes.byteLength > 16 * 1024) return undefined;
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return undefined;
  }
  if (
    value?.version !== 1 ||
    value.repository !== publicationRepository ||
    value.ref !== "refs/heads/main" ||
    value.codeSha !== codeSha ||
    value.policy !== codeValidationPolicy ||
    value.result !== "passed" ||
    JSON.stringify(value.checks) !== JSON.stringify(codeValidationChecks) ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(value.run ?? "") ||
    typeof value.completedAt !== "string" ||
    !Number.isFinite(Date.parse(value.completedAt)) ||
    new Date(value.completedAt).toISOString() !== value.completedAt
  )
    return undefined;
  return {
    version: 1,
    repository: publicationRepository,
    ref: "refs/heads/main",
    codeSha,
    policy: codeValidationPolicy,
    checks: [...codeValidationChecks],
    result: "passed",
    run: value.run,
    completedAt: value.completedAt,
  };
}

export async function validatePublicationCode(
  store,
  { codeSha, run, completedAt = () => new Date().toISOString() },
  executeCheck,
) {
  const key = codeValidationKey(codeSha);
  if (!/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run ?? ""))
    throw new Error("Validated workflow identity required");
  const prior = await readCodeValidation(store, codeSha);
  if (prior) return { skipped: true, receipt: prior };
  for (const check of codeValidationChecks)
    if ((await executeCheck(check)) !== true)
      throw new Error("Full code validation did not pass");
  const receipt = {
    version: 1,
    repository: publicationRepository,
    ref: "refs/heads/main",
    codeSha,
    policy: codeValidationPolicy,
    checks: [...codeValidationChecks],
    result: "passed",
    run,
    completedAt: completedAt(),
  };
  if (
    typeof receipt.completedAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.completedAt)) ||
    new Date(receipt.completedAt).toISOString() !== receipt.completedAt
  )
    throw new Error("Validation completion timestamp invalid");
  const writeSucceeded = await store
    .put(key, Buffer.from(JSON.stringify(receipt)), true)
    .then(
      () => true,
      () => false,
    );
  let winner;
  try {
    winner = await readCodeValidation(store, codeSha);
  } catch {
    throw new Error("Code validation receipt winner is unreadable");
  }
  if (!winner) throw new Error("Code validation receipt write is unverified");
  const matchesAttempt = JSON.stringify(winner) === JSON.stringify(receipt);
  return {
    skipped: false,
    receipt: winner,
    receiptWinner: {
      run: winner.run,
      completedAt: winner.completedAt,
      matchesAttempt,
      writeSucceeded,
    },
  };
}
