import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomBytes, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { CloudflareServing } from "./obsidian-cloudflare.mjs";
import {
  PublicationTransaction,
  targetNamespace,
} from "./obsidian-transaction.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";
import { runPublicationCommand } from "./obsidian-process.mjs";

const fingerprint = /^[a-f0-9]{64}$/;
export function publicPublicationReceipt(
  candidate,
  result,
  target,
  durationMs,
  counters,
  run,
  verifiedAt = new Date().toISOString(),
) {
  if (
    !/^(production|staging|pr\/[1-9][0-9]*)$/.test(target) ||
    candidate.state?.mode !== (target.startsWith("pr/") ? "preview" : target) ||
    !/^[a-f0-9]{40}$/.test(candidate.codeSha ?? "") ||
    [
      candidate.source,
      candidate.code,
      candidate.digest,
      result.accepted?.receipt?.artifact,
    ].some((value) => !fingerprint.test(value ?? "")) ||
    !/^[a-f0-9-]{32,36}$/.test(result.accepted?.receipt?.deployment ?? "") ||
    !Number.isSafeInteger(durationMs) ||
    durationMs < 0 ||
    typeof verifiedAt !== "string" ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    new Date(verifiedAt).toISOString() !== verifiedAt ||
    !/^[a-z0-9-]{1,100}$/.test(run)
  )
    throw new Error("Publication receipt correlation invalid");
  const usage = {};
  for (const [provider, fields] of Object.entries({
    state: ["heads", "gets", "puts", "bytesRead", "bytesWritten"],
    worker: [
      "apiReads",
      "apiWrites",
      "markerReads",
      "deployments",
      "deploymentAttempts",
      "rollbacks",
      "rollbackAttempts",
      "verifications",
    ],
  })) {
    usage[provider] = {};
    for (const key of fields) {
      const count = counters[provider]?.[key] ?? 0;
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error("Invalid publication usage counter");
      usage[provider][key] = count;
    }
  }
  return {
    version: 1,
    policyVersion: 1,
    target,
    source: candidate.source,
    code: candidate.code,
    codeSha: candidate.codeSha,
    digest: candidate.digest,
    artifact: result.accepted.receipt.artifact,
    deployment: result.accepted.receipt.deployment,
    skipped: result.skipped === true,
    verifiedAt,
    durationMs,
    run,
    counters: usage,
  };
}

export function protectedPublicationReport(
  candidate,
  target,
  status,
  diagnostics,
  receipt,
) {
  if (receipt && typeof receipt.verifiedAt !== "string")
    throw new Error("Original verification timestamp required");
  if (
    !/^(production|staging|pr\/[1-9][0-9]*)$/.test(target) ||
    candidate.state?.mode !== (target.startsWith("pr/") ? "preview" : target) ||
    !fingerprint.test(candidate.source ?? "") ||
    !["queued", "verified", "degraded", "failed"].includes(status) ||
    diagnostics?.version !== 1 ||
    diagnostics.source !== candidate.source ||
    diagnostics.digest !== candidate.digest ||
    diagnostics.mode !== candidate.state?.mode ||
    !Array.isArray(diagnostics.files) ||
    !Array.isArray(diagnostics.issues) ||
    diagnostics.issues.length > 10000
  )
    throw new Error("Protected diagnostics correlation invalid");
  const select = (item, keys) =>
    Object.fromEntries(
      keys
        .filter((key) => item[key] !== undefined)
        .map((key) => [key, item[key]]),
    );
  const safeReceipt = receipt
    ? publicPublicationReceipt(
        candidate,
        { accepted: { receipt }, skipped: receipt.skipped },
        target,
        receipt.durationMs,
        receipt.counters,
        receipt.run,
        receipt.verifiedAt,
      )
    : undefined;
  const report = {
    version: 1,
    target,
    source: candidate.source,
    code: candidate.code,
    codeSha: candidate.codeSha,
    digest: candidate.digest,
    status,
    reportedAt: new Date().toISOString(),
    files: diagnostics.files.map((item) =>
      select(item, [
        "path",
        "revision",
        "slug",
        "environment",
        "sync",
        "draft",
      ]),
    ),
    masks: diagnostics.masks,
    issues: diagnostics.issues.map((item) => {
      if (
        typeof item?.key !== "string" ||
        !item.key ||
        !/^[a-z_]+$/.test(item.category ?? "")
      )
        throw new Error("Invalid protected issue identity");
      return {
        ...select(item, [
          "key",
          "category",
          "file_id",
          "path",
          "revision",
          "route",
          "fallback",
          "observed_at",
        ]),
        key: fingerprint.test(item.key)
          ? item.key
          : createHash("sha256").update(item.key).digest("hex"),
      };
    }),
    receipt: safeReceipt,
  };
  if (Buffer.byteLength(JSON.stringify(report)) > 2 * 1024 * 1024)
    throw new Error("Protected report exceeds read limit");
  return report;
}

export async function recordPublication(
  candidate,
  diagnostics,
  {
    store,
    serving,
    namespace,
    bootstrap = false,
    unchangedOnly = false,
    started = performance.now(),
  },
) {
  if (bootstrap && unchangedOnly)
    throw new Error("Bootstrap requires a tested artifact publication");
  const reportKey = `reports/${namespace}.json`,
    writeReport = async (status, receipt) =>
      store.put(
        reportKey,
        Buffer.from(
          JSON.stringify(
            protectedPublicationReport(
              candidate,
              namespace,
              status,
              diagnostics,
              receipt,
            ),
          ),
        ),
      );
  await writeReport("queued");
  let result;
  try {
    const transaction = new PublicationTransaction(store, serving, namespace);
    result = unchangedOnly
      ? await transaction.reconcileUnchanged(candidate)
      : await transaction.publish(candidate, { bootstrap: bootstrap });
    if (!result)
      return { version: 1, target: namespace, status: "build-required" };
  } catch {
    const failed = {
      ...diagnostics,
      issues: [
        ...diagnostics.issues,
        {
          key: candidate.artifact ?? candidate.digest,
          category: "deployment_failed",
        },
      ],
    };
    let report;
    try {
      report = protectedPublicationReport(
        candidate,
        namespace,
        "failed",
        failed,
      );
    } catch {
      report = protectedPublicationReport(
        candidate,
        namespace,
        "failed",
        diagnostics,
      );
    }
    await store
      .put(reportKey, Buffer.from(JSON.stringify(report)))
      .catch(() => {});
    throw new Error(
      "Publication failed; inspect the protected target report and journal",
    );
  }
  const run = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `manual-${randomBytes(12).toString("hex")}`;
  const receipt = publicPublicationReceipt(
    candidate,
    result,
    namespace,
    Math.round(performance.now() - started),
    { state: store.counters, worker: serving.counters },
    run,
  );
  await store.put(
    `receipts/${namespace}/${run}.json`,
    Buffer.from(JSON.stringify(receipt)),
  );
  await writeReport(
    diagnostics.issues.length ? "degraded" : "verified",
    receipt,
  );
  receipt.counters.state = { ...store.counters };
  receipt.counters.worker = { ...serving.counters };
  return receipt;
}

function privateInput(path) {
  const file = resolve(path ?? ""),
    root = `${resolve(".obsidian-publish")}/`;
  if (!file.startsWith(root) || statSync(file).size > 64 * 1024 * 1024)
    throw new Error("Ignored private publication input required");
  return JSON.parse(readFileSync(file, "utf8"));
}

async function main() {
  const started = performance.now();
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      candidate: { type: "string" },
      diagnostics: { type: "string" },
      access: { type: "string" },
      "bootstrap-receipt": { type: "string" },
      bootstrap: { type: "boolean", default: false },
      "unchanged-only": { type: "boolean", default: false },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    },
  });
  const namespace = targetNamespace(
    values.mode,
    values.pr ? Number(values.pr) : undefined,
  );
  if (namespace === "local")
    throw new Error("Hosted publication mode required");
  if (values.bootstrap && values["unchanged-only"])
    throw new Error("Bootstrap requires a tested artifact publication");
  const candidate = privateInput(values.candidate),
    diagnostics = privateInput(values.diagnostics);
  const prepared = candidate.verification?.prepared;
  if (
    candidate.state?.version !== 1 ||
    candidate.state?.mode !== values.mode ||
    prepared?.version !== 1 ||
    prepared.mode !== values.mode ||
    prepared.revision !== candidate.source ||
    prepared.digest !== candidate.digest ||
    JSON.stringify(prepared.state) !== JSON.stringify(candidate.state)
  )
    throw new Error("Candidate target and preparation differ");
  const code = await runPublicationCommand("git", ["rev-parse", "HEAD"], {
    purpose: "build",
  });
  if (candidate.codeSha !== code.stdout.trim())
    throw new Error("Candidate code does not match the checkout");
  const transport = environmentTransport("OBSIDIAN_STATE"),
    store = new PrivateR2Store(
      transport,
      r2Target(values.account, "justindfuller-obsidian-state"),
    );
  try {
    const serving = new CloudflareServing({
      account: values.account,
      mode: values.mode,
      pr: values.pr ? Number(values.pr) : undefined,
      token:
        values.mode === "staging"
          ? process.env.CLOUDFLARE_STAGING_API_TOKEN
          : process.env.CLOUDFLARE_API_TOKEN,
      accessConfig: values.access ? privateInput(values.access) : undefined,
      accessToken: process.env.CLOUDFLARE_ACCESS_API_TOKEN,
      credentials: {
        clientId: process.env.CF_ACCESS_CLIENT_ID,
        clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
      },
      store,
      bootstrapReceipt: values["bootstrap-receipt"]
        ? privateInput(values["bootstrap-receipt"])
        : undefined,
    });
    console.log(
      JSON.stringify(
        await recordPublication(candidate, diagnostics, {
          store,
          serving,
          namespace,
          bootstrap: values.bootstrap,
          unchangedOnly: values["unchanged-only"],
          started,
        }),
      ),
    );
  } finally {
    transport.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Publication command failed; inspect protected target state and credentials",
    );
    process.exitCode = 1;
  });
