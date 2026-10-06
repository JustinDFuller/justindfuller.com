import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const commandKinds = new Set(["go", "docker", "git", "node", "npm"]);
const spawnCodes = new Set([
  "EACCES",
  "EAGAIN",
  "E2BIG",
  "EISDIR",
  "EMFILE",
  "ENFILE",
  "ENOENT",
  "ENOMEM",
  "ENOTDIR",
  "EPERM",
  "ETIMEDOUT",
]);

function commandKind(command) {
  const name = String(command).split(/[\\/]/).at(-1);
  return commandKinds.has(name) ? name : "other";
}

function failureCategory(stderr) {
  const text = String(stderr ?? "").toLowerCase();
  if (/no space left|disk quota exceeded|storage exhausted/.test(text))
    return "storage-exhausted";
  if (
    /too many processes|resource temporarily unavailable|pids limit|process limit/.test(
      text,
    )
  )
    return "process-limit";
  if (
    /permission denied|read-only file system|operation not permitted|access is denied/.test(
      text,
    )
  )
    return "filesystem-denied";
  if (
    /module not found|cannot find package|no required module|dependency unavailable|module lookup disabled|missing go\.sum entry|updates to go\.mod needed|package .* is not in std|requires go >=/.test(
      text,
    )
  )
    return "dependency-unavailable";
  if (
    /invalid (private )?(input|source|state)|source integrity|input rejected|accepted state/.test(
      text,
    )
  )
    return "private-input-rejected";
  return "unknown";
}

export class PublicationSubprocessError extends Error {
  constructor(command, error) {
    super("Publication subprocess failed; inspect protected publication state");
    this.name = "PublicationSubprocessError";
    this.commandKind = commandKind(command);
    this.exitCode = Number.isInteger(error?.code) ? error.code : -1;
    this.spawnCode = spawnCodes.has(error?.code) ? error.code : "unknown";
    this.timedOut = error?.killed === true && error?.signal === "SIGTERM";
    this.signaled =
      typeof error?.signal === "string" && error.signal.length > 0;
    this.failureCategory = failureCategory(error?.stderr);
  }
}

export function publicationFailureSummary(error) {
  if (!(error instanceof PublicationSubprocessError))
    return { category: "unknown" };
  return {
    commandKind: error.commandKind,
    exitCode: error.exitCode,
    spawnCode: error.spawnCode,
    timedOut: error.timedOut,
    signaled: error.signaled,
    category: error.failureCategory,
  };
}

export function publicationEnvironment(
  input = process.env,
  purpose = "build",
  token,
) {
  if (!["build", "deploy", "verify", "prepare"].includes(purpose))
    throw new Error("Unknown publication subprocess purpose");
  const env = {};
  for (const key of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "TZ",
    "CI",
    "GOCACHE",
    "GOMODCACHE",
    "GOPATH",
    "GOFLAGS",
    "CGO_ENABLED",
    "CC",
    "CXX",
    "WRANGLER_LOG_PATH",
    "GITHUB_SHA",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_REPOSITORY",
    "GITHUB_REF_NAME",
    "GITHUB_HEAD_REF",
    "GITHUB_EVENT_NAME",
    "CLOUDFLARE_PREVIEW_BUILD",
  ])
    if (input[key] !== undefined) env[key] = input[key];
  if (purpose === "prepare")
    for (const key of [
      "OBSIDIAN_SOURCE_ACCESS_KEY_ID",
      "OBSIDIAN_SOURCE_SECRET_ACCESS_KEY",
    ])
      if (input[key]) env[key] = input[key];
  if (purpose === "verify")
    for (const key of [
      "CF_ACCESS_CLIENT_ID",
      "CF_ACCESS_CLIENT_SECRET",
      "CLOUDFLARE_ACCESS_API_TOKEN",
    ])
      if (input[key]) env[key] = input[key];
  if (purpose === "deploy") {
    if (!token) throw new Error("Explicit deployment credential required");
    env.CLOUDFLARE_API_TOKEN = token;
  }
  return env;
}

export async function runPublicationCommand(command, args, options = {}) {
  try {
    return await execute(command, args, {
      cwd: options.cwd,
      env: publicationEnvironment(options.env, options.purpose, options.token),
      maxBuffer: 32 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
    });
  } catch (error) {
    throw new PublicationSubprocessError(command, error);
  }
}
