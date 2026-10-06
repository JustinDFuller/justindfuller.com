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
import {
  publicationFailureSummary,
  runPublicationCommand,
} from "./obsidian-process.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { protectedPublicationReport } from "./record-obsidian-publication.mjs";
import { preparePublicationTarget } from "./obsidian-pipeline.mjs";

const fingerprint = /^[a-f0-9]{64}$/;
const prepareImage = "golang:1.26.0-bookworm";

export function isolatedPreparationCommand({
  workspace,
  controlWorkspace,
  moduleCache,
  uid,
  gid,
  args,
}) {
  return [
    "run",
    "--pull=never",
    "--rm",
    "--network=none",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=1g",
    "--user",
    `${uid}:${gid}`,
    "--mount",
    `type=bind,source=${workspace},target=/workspace`,
    "--mount",
    `type=bind,source=${moduleCache},target=/go/pkg/mod,readonly`,
    "--mount",
    `type=bind,source=${controlWorkspace},target=/workspace/${controlWorkspace.slice(workspace.length + 1)},readonly`,
    "--tmpfs",
    `/go-cache:rw,nosuid,nodev,uid=${uid},gid=${gid},size=2g`,
    "--tmpfs",
    `/go-run:rw,exec,nosuid,nodev,uid=${uid},gid=${gid},size=1g`,
    "--workdir",
    "/workspace",
    "--env",
    "GOMODCACHE=/go/pkg/mod",
    "--env",
    "GOCACHE=/go-cache",
    "--env",
    "GOTMPDIR=/go-run",
    prepareImage,
    "go",
    ...args,
  ];
}

export async function runPreparationCommand(
  execute,
  args,
  cwd,
  env = process.env,
  controlWorkspace,
) {
  if (env.OBSIDIAN_PREPARE_CONTAINER === undefined)
    return execute("go", args, { cwd, purpose: "build" });
  if (env.OBSIDIAN_PREPARE_CONTAINER !== "true")
    throw new Error("Isolated preparation container is required");
  const workspace = await realpath(cwd),
    moduleCacheInput = env.OBSIDIAN_PREPARE_GOMODCACHE;
  if (!moduleCacheInput || !moduleCacheInput.startsWith("/"))
    throw new Error("Isolated preparation module cache is unavailable");
  const moduleCache = await realpath(moduleCacheInput),
    moduleStat = await stat(moduleCache);
  if (
    !moduleStat.isDirectory() ||
    moduleCache.startsWith(`${workspace}/`) ||
    workspace.startsWith(`${moduleCache}/`)
  )
    throw new Error("Isolated preparation module cache path is invalid");
  if (
    env.OBSIDIAN_PREPARE_IMAGE !== undefined &&
    env.OBSIDIAN_PREPARE_IMAGE !== prepareImage
  )
    throw new Error("Isolated preparation image differs from policy");
  if (!controlWorkspace)
    throw new Error("Isolated preparation control checkout is unavailable");
  const control = await realpath(resolve(cwd, controlWorkspace)),
    relativeControl = control.slice(workspace.length + 1);
  if (
    control === workspace ||
    !control.startsWith(`${workspace}/`) ||
    !relativeControl ||
    [workspace, control, moduleCache].some((path) => path.includes(","))
  )
    throw new Error("Isolated preparation control checkout path is invalid");
  if (
    typeof process.getuid !== "function" ||
    typeof process.getgid !== "function"
  )
    throw new Error("Isolated Linux preparation runner required");
  const argsForDocker = isolatedPreparationCommand({
    workspace,
    controlWorkspace: control,
    moduleCache,
    uid: process.getuid(),
    gid: process.getgid(),
    args,
  });
  return execute("docker", argsForDocker, { cwd, purpose: "build" });
}

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
  pinnedSource,
  sourceUnavailable = false,
  codeSha,
  account = "9dce34804a27754a4ea66a5789827dfa",
  cwd = process.cwd(),
  controlWorkspace = cwd,
  execute = runPublicationCommand,
}) {
  const namespace = targetNamespace(mode, pr);
  if (
    namespace === "local" ||
    !["site", "content", "preview"].includes(kind) ||
    (mode === "preview" && kind === "content") ||
    (mode !== "preview" && kind === "preview") ||
    (bootstrap && kind === "content") ||
    (pinnedSource !== undefined && sourceUnavailable) ||
    (pinnedSource !== undefined && typeof pinnedSource !== "string") ||
    (pinnedSource === undefined && !sourceUnavailable) ||
    !/^[a-f0-9]{32}$/.test(account)
  )
    throw new Error("Explicit pinned source or source outage required");
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
  if (sourceUnavailable && !previous)
    throw new Error("Source outage requires accepted state");
  const identity = await serving.identity();
  if (
    typeof identity !== "string" ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(identity) ||
    (previous && previous.receipt?.deployment !== identity)
  )
    throw new Error("Accepted state differs from the serving deployment");
  let pinnedInput;
  if (pinnedSource !== undefined) {
    pinnedInput = await readPrivatePreparation(pinnedSource, cwd);
    if (
      !fingerprint.test(pinnedInput?.revision ?? "") ||
      pinnedInput?.snapshot?.version !== 1 ||
      !pinnedInput.bodies ||
      typeof pinnedInput.bodies !== "object" ||
      Array.isArray(pinnedInput.bodies) ||
      !pinnedInput.ready ||
      typeof pinnedInput.ready !== "object" ||
      Array.isArray(pinnedInput.ready)
    )
      throw new Error("Private pinned source input is invalid");
  }
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
  if (pinnedSource !== undefined) {
    await saveProtectedReport(files.pinned, pinnedInput, cwd);
    await runPreparationCommand(
      execute,
      [...common, "--source", files.pinned],
      cwd,
      process.env,
      controlWorkspace,
    );
  } else if (sourceUnavailable) {
    sourceAvailable = false;
    await runPreparationCommand(
      execute,
      [...common, "--accepted-only"],
      cwd,
      process.env,
      controlWorkspace,
    );
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
      "pinned-source": { type: "string" },
      "source-unavailable": { type: "boolean", default: false },
      "control-workspace": { type: "string", default: process.cwd() },
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
        workspace: values["control-workspace"],
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
          pinnedSource: values["pinned-source"],
          sourceUnavailable: values["source-unavailable"],
          controlWorkspace: values["control-workspace"],
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
  await main().catch((error) => {
    console.error(
      "Hosted preparation failed; inspect private target state and source credentials",
    );
    console.error(JSON.stringify(publicationFailureSummary(error)));
    process.exitCode = 1;
  });
