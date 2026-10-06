import { readFile, realpath } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  artifactPublication,
  validateBuiltArtifact,
} from "./build-obsidian-target.mjs";
import {
  createPublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  publicationFailureSummary,
  runPublicationCommand,
} from "./obsidian-process.mjs";

const accountDefault = "9dce34804a27754a4ea66a5789827dfa";

export async function renderPrivateBuild({
  mode,
  pr,
  run,
  codeSha,
  account = accountDefault,
  goRoot,
  goModCache,
  cwd = process.cwd(),
  execute = runPublicationCommand,
}) {
  const namespace = targetNamespace(mode, pr),
    root = resolve(await realpath(cwd), ".obsidian-publish"),
    inputPath = resolve(
      cwd,
      `.obsidian-publish/hosted/${namespace}/build-input.json`,
    ),
    input = JSON.parse(await readFile(inputPath, "utf8"));
  if (
    !inputPath.startsWith(`${root}/`) ||
    input.version !== 1 ||
    input.target !== namespace ||
    input.mode !== mode ||
    input.pr !== pr ||
    input.run !== run ||
    input.codeSha !== codeSha ||
    input.publication !== artifactPublication(namespace, run, input.candidate)
  )
    throw new Error("Private build identity differs from the locked target");
  const before = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (before.stdout.trim() !== codeSha)
    throw new Error("Build checkout differs from the resolved code");
  const overlay = `.obsidian-publish/hosted/${namespace}/build-prepared.json`;
  await saveProtectedReport(
    overlay,
    input.candidate.verification.prepared,
    cwd,
  );
  await execute(
    "docker",
    [
      ...isolatedRenderer(cwd, goRoot, goModCache),
      "npm",
      "run",
      "build:cloudflare",
      "--",
      "--mode",
      mode,
      "--overlay",
      overlay,
      "--publication-id",
      input.publication,
    ],
    { cwd, purpose: "build" },
  );
  if (mode !== "preview")
    await execute(
      "docker",
      [
        ...isolatedRenderer(cwd, goRoot, goModCache),
        "./node_modules/.bin/cf",
        "deploy",
        "--prebuilt",
        "--mode",
        mode,
        "--dry-run",
      ],
      { cwd, purpose: "build" },
    );
  const after = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (after.stdout.trim() !== codeSha)
    throw new Error("Build code changed before private artifact handoff");
  const bytes = createPublicationArchive(cwd),
    checksum = archiveChecksum(bytes),
    marker = validateBuiltArtifact(bytes, checksum, {
      account,
      mode,
      publication: input.publication,
    }),
    archivePath = `.obsidian-publish/hosted/${namespace}/rendered.tar`,
    metadata = {
      version: 1,
      target: namespace,
      run,
      codeSha,
      preparation: input.preparation,
      publication: input.publication,
      checksum,
      bytes: bytes.length,
      marker,
    };
  await saveProtectedReport(
    archivePath,
    { bytes: bytes.toString("base64") },
    cwd,
  );
  await saveProtectedReport(
    `.obsidian-publish/hosted/${namespace}/rendered.json`,
    metadata,
    cwd,
  );
  return { version: 1, target: namespace, checksum, bytes: bytes.length };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      run: { type: "string" },
      "code-sha": { type: "string" },
      account: { type: "string", default: accountDefault },
      "go-root": { type: "string" },
      "go-mod-cache": { type: "string" },
    },
  });
  console.log(
    JSON.stringify(
      await renderPrivateBuild({
        mode: values.mode,
        pr: values.pr ? Number(values.pr) : undefined,
        run: values.run,
        codeSha: values["code-sha"],
        account: values.account,
        goRoot: values["go-root"],
        goModCache: values["go-mod-cache"],
      }),
    ),
  );
}

export function isolatedRenderer(cwd, goRoot, goModCache) {
  if (
    typeof process.getuid !== "function" ||
    typeof process.getgid !== "function"
  )
    throw new Error("Isolated Linux build runner required");
  if (!goRoot?.startsWith("/") || !goModCache?.startsWith("/"))
    throw new Error("Pinned Go toolchain and module cache are required");
  const controlPath = resolve(cwd, "control");
  let controlMount = [];
  if (existsSync(controlPath)) {
    if (lstatSync(controlPath).isSymbolicLink())
      throw new Error("Trusted control mount cannot be a symlink");
    controlMount = ["--volume", `${controlPath}:/workspace/control:ro`];
  }
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
    "--tmpfs",
    `/go-run:rw,exec,nosuid,nodev,uid=${process.getuid()},gid=${process.getgid()},size=1g`,
    "--env",
    "GOTMPDIR=/go-run",
    "--env",
    "HOME=/tmp/home",
    "--env",
    "npm_config_cache=/tmp/npm-cache",
    "--env",
    "GOROOT=/opt/go",
    "--env",
    "GOMODCACHE=/go/pkg/mod",
    "--env",
    "GOCACHE=/workspace/.obsidian-publish/go-cache",
    "--env",
    "GOTOOLCHAIN=local",
    "--env",
    "PATH=/opt/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--volume",
    `${resolve(cwd)}:/workspace`,
    "--volume",
    `${goRoot}:/opt/go:ro`,
    "--volume",
    `${goModCache}:/go/pkg/mod:ro`,
    ...controlMount,
    "--workdir",
    "/workspace",
    "node:22-bookworm",
  ];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch((error) => {
    console.error("Private artifact rendering failed");
    console.error(JSON.stringify(publicationFailureSummary(error)));
    process.exitCode = 1;
  });
