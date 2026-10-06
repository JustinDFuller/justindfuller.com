import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

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
  } catch {
    throw new Error(
      "Publication subprocess failed; inspect protected publication state",
    );
  }
}
