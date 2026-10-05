import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import {
  PublicationTransaction,
  targetNamespace,
} from "./obsidian-transaction.mjs";
import { CloudflareServing } from "./obsidian-cloudflare.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { protectedPublicationReport } from "./record-obsidian-publication.mjs";
import { preparePublicationTarget } from "./obsidian-pipeline.mjs";

const fingerprint = /^[a-f0-9]{64}$/;

export async function readPrivatePreparation(path, cwd = process.cwd()) {
  const root = resolve(await realpath(cwd), ".obsidian-publish"),
    file = await realpath(resolve(cwd, path));
  if (
    !file.startsWith(`${root}/`) ||
    (await stat(file)).size > 64 * 1024 * 1024
  )
    throw new Error("Bounded ignored private preparation input required");
  return JSON.parse(await readFile(file, "utf8"));
}

export function preparationCode(codeSha, mode) {
  if (
    !/^[a-f0-9]{40}$/.test(codeSha ?? "") ||
    !["production", "staging", "preview"].includes(mode)
  )
    throw new Error("Exact hosted preparation code required");
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, policyVersion: 1, codeSha, mode }))
    .digest("hex");
}

export async function prepareHostedTarget({
  store,
  serving,
  mode,
  pr,
  kind = "site",
  bootstrap = false,
  codeSha,
  account = "9dce34804a27754a4ea66a5789827dfa",
  cwd = process.cwd(),
  execute = runPublicationCommand,
}) {
  const namespace = targetNamespace(mode, pr);
  if (
    namespace === "local" ||
    !["site", "content", "preview"].includes(kind) ||
    (mode === "preview" && kind === "content") ||
    (mode !== "preview" && kind === "preview") ||
    (bootstrap && kind === "content") ||
    !/^[a-f0-9]{32}$/.test(account)
  )
    throw new Error("Explicit hosted target preparation required");
  const checkedOut = (
    await execute("git", ["rev-parse", "HEAD"], {
      cwd,
      purpose: "build",
    })
  ).stdout.trim();
  if (codeSha !== undefined && codeSha !== checkedOut)
    throw new Error("Preparation checkout differs from the resolved code");
  codeSha = checkedOut;
  const code = preparationCode(codeSha, mode),
    transaction = new PublicationTransaction(store, serving, namespace);
  await transaction.reconcile();
  const previous = await transaction.read(transaction.currentKey);
  if (
    (!previous && !bootstrap) ||
    (previous && bootstrap) ||
    (previous &&
      (previous.state?.version !== 1 || previous.state.mode !== mode))
  )
    throw new Error("Installed accepted state is unavailable or mismatched");
  const identity = await serving.identity();
  if (
    typeof identity !== "string" ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(identity) ||
    (previous && previous.receipt?.deployment !== identity)
  )
    throw new Error("Accepted state differs from the serving deployment");
  const directory = `.obsidian-publish/hosted/${namespace}`,
    files = Object.fromEntries(
      ["state", "prepared", "diagnostics", "pinned", "candidate"].map(
        (name) => [name, `${directory}/${name}.json`],
      ),
    );
  for (const path of Object.values(files))
    await saveProtectedReport(path, {}, cwd);
  if (previous) await saveProtectedReport(files.state, previous.state, cwd);
  const common = [
    "run",
    "./cmd/prepare-obsidian",
    "--mode",
    mode,
    "--out",
    files.prepared,
    "--report-out",
    files.diagnostics,
    ...(previous ? ["--state", files.state] : ["--bootstrap"]),
  ];
  let sourceAvailable = true;
  try {
    await execute(
      "go",
      [...common, "--r2", "--account", account, "--source-out", files.pinned],
      { cwd, purpose: "prepare" },
    );
  } catch {
    if (!previous) throw new Error("Initial private source preparation failed");
    sourceAvailable = false;
    await execute("go", [...common, "--accepted-only"], {
      cwd,
      purpose: "build",
    });
  }
  const prepared = await readPrivatePreparation(files.prepared, cwd),
    diagnostics = await readPrivatePreparation(files.diagnostics, cwd);
  if (
    prepared?.version !== 1 ||
    prepared.mode !== mode ||
    prepared.state?.version !== 1 ||
    prepared.state.mode !== mode ||
    prepared.state.revision !== prepared.revision ||
    !fingerprint.test(prepared.revision ?? "") ||
    !fingerprint.test(prepared.digest ?? "") ||
    !Array.isArray(prepared.entries) ||
    !prepared.images ||
    typeof prepared.images !== "object" ||
    Array.isArray(prepared.images) ||
    diagnostics?.version !== 1 ||
    diagnostics.mode !== mode ||
    diagnostics.source !== prepared.revision ||
    diagnostics.digest !== prepared.digest ||
    !Array.isArray(diagnostics.files) ||
    !Array.isArray(diagnostics.issues) ||
    (!sourceAvailable &&
      !diagnostics.issues.some((issue) => issue.category === "source_degraded"))
  )
    throw new Error("Private preparation correlation differs");
  if (sourceAvailable) {
    const pinned = await readPrivatePreparation(files.pinned, cwd);
    if (pinned.revision !== prepared.revision)
      throw new Error("Pinned source differs from preparation");
  }
  const candidate = {
    source: prepared.revision,
    code,
    codeSha,
    digest: prepared.digest,
    state: prepared.state,
    verification: { prepared },
  };
  await saveProtectedReport(files.candidate, candidate, cwd);
  const retained = kind === "content" && !sourceAvailable;
  if (retained)
    await store.put(
      `reports/${namespace}.json`,
      Buffer.from(
        JSON.stringify(
          protectedPublicationReport(
            candidate,
            namespace,
            "degraded",
            diagnostics,
          ),
        ),
      ),
    );
  return {
    version: 1,
    status: "prepared",
    target: namespace,
    decision: retained ? "retain-serving" : "candidate",
    sourceAvailable,
    source: candidate.source,
    codeSha,
    code,
    digest: candidate.digest,
    posts: prepared.entries.length,
    images: Object.keys(prepared.images).length,
    issues: diagnostics.issues.length,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      kind: { type: "string", default: "site" },
      run: { type: "string" },
      bootstrap: { type: "boolean", default: false },
      access: { type: "string" },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    },
  });
  const {
    environmentTransport,
    PrivateR2Store,
    r2Target,
    promoteProductionImages,
  } = await import("../tools/obsidian-image-publisher/src/publication.ts");
  const transport = environmentTransport("OBSIDIAN_STATE");
  let sourceTransport, mediaTransport;
  try {
    const store = new PrivateR2Store(
        transport,
        r2Target(values.account, "justindfuller-obsidian-state"),
      ),
      serving = new CloudflareServing({
        account: values.account,
        mode: values.mode,
        pr: values.pr ? Number(values.pr) : undefined,
        token:
          values.mode === "staging"
            ? process.env.CLOUDFLARE_STAGING_API_TOKEN
            : process.env.CLOUDFLARE_API_TOKEN,
        accessConfig: values.access
          ? await readPrivatePreparation(values.access)
          : undefined,
        accessToken: process.env.CLOUDFLARE_ACCESS_API_TOKEN,
        credentials: {
          clientId: process.env.CF_ACCESS_CLIENT_ID,
          clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
        },
        store,
      });
    console.log(
      JSON.stringify(
        await preparePublicationTarget({
          store,
          serving,
          mode: values.mode,
          pr: values.pr ? Number(values.pr) : undefined,
          kind: values.kind,
          run:
            values.run ??
            (process.env.GITHUB_RUN_ID
              ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
              : undefined),
          promote: async (prepared) => {
            sourceTransport = environmentTransport("OBSIDIAN_SOURCE");
            mediaTransport = environmentTransport("OBSIDIAN_MEDIA");
            return promoteProductionImages(
              prepared,
              {
                transport: sourceTransport,
                target: r2Target(
                  values.account,
                  "justindfuller-obsidian-source",
                ),
              },
              {
                transport: mediaTransport,
                target: r2Target(
                  values.account,
                  "justindfuller-obsidian-media",
                ),
              },
            );
          },
          bootstrap: values.bootstrap,
          account: values.account,
        }),
      ),
    );
  } finally {
    transport.close();
    sourceTransport?.close();
    mediaTransport?.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Hosted preparation failed; inspect private target state and source credentials",
    );
    process.exitCode = 1;
  });
