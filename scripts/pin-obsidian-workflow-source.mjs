import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";

const execFile = promisify(execFileCallback);
const accountDefault = "9dce34804a27754a4ea66a5789827dfa";

export function acceptedStateForPin(value, namespace, mode, bootstrap) {
  if (!value) {
    if (bootstrap) return undefined;
    throw new Error("Accepted target state is unavailable");
  }
  if (
    value.version !== 1 ||
    value.namespace !== namespace ||
    value.state?.version !== 1 ||
    value.state.mode !== mode ||
    !/^[a-f0-9]{64}$/.test(value.state.revision ?? "") ||
    value.state.revision !== value.source ||
    value.receipt?.deployment === undefined
  )
    throw new Error("Accepted target state is incompatible");
  return value.state;
}

export function validPinnedSource(value) {
  return Boolean(
    value?.snapshot?.version === 1 &&
    /^[a-f0-9]{64}$/.test(value.revision ?? "") &&
    value.snapshot.files &&
    typeof value.snapshot.files === "object" &&
    value.snapshot.images &&
    typeof value.snapshot.images === "object" &&
    value.bodies &&
    typeof value.bodies === "object" &&
    value.ready &&
    typeof value.ready === "object",
  );
}

export async function pinWorkflowSource({
  mode,
  pr,
  bootstrap = false,
  account = accountDefault,
  cwd = process.cwd(),
  targetWorkspace = process.env.GITHUB_WORKSPACE ?? resolve(cwd, ".."),
  execute = execFile,
  transportFactory = environmentTransport,
}) {
  const namespace = targetNamespace(mode, pr);
  if (namespace === "local" || !/^[a-f0-9]{32}$/.test(account))
    throw new Error("Explicit hosted source target required");
  const transport = transportFactory("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
        transport,
        r2Target(account, "justindfuller-obsidian-state"),
      ),
      acceptedBytes = await store.get(
        `accepted/${namespace}/current.json`,
        64 * 1024 * 1024,
      ),
      accepted = acceptedBytes
        ? JSON.parse(Buffer.from(acceptedBytes).toString("utf8"))
        : undefined,
      state = acceptedStateForPin(accepted, namespace, mode, bootstrap),
      directory = `.obsidian-publish/hosted/${namespace}`,
      stateFile = `${directory}/state.json`,
      sourceFile = `${directory}/source.json`;
    if (state) await saveProtectedReport(stateFile, state, cwd);
    else await mkdir(resolve(cwd, directory), { recursive: true, mode: 0o700 });
    const args = [
      resolve(cwd, ".obsidian-publish/bin/pin-obsidian-source"),
      "--account",
      account,
      "--bucket",
      "justindfuller-obsidian-source",
      "--out",
      sourceFile,
      ...(state ? ["--state", stateFile] : []),
    ];
    try {
      await execute(args[0], args.slice(1), {
        cwd,
        env: publicationEnvironment(process.env, "prepare"),
        maxBuffer: 4 * 1024 * 1024,
        timeout: 15 * 60 * 1000,
      });
    } catch (error) {
      if (error.code === 10) {
        if (process.env.GITHUB_OUTPUT)
          await import("node:fs/promises").then(({ appendFile }) =>
            appendFile(process.env.GITHUB_OUTPUT, "source_unavailable=true\n"),
          );
        return { version: 1, target: namespace, sourceUnavailable: true };
      }
      throw new Error("Trusted source pin failed");
    }
    const pinned = JSON.parse(await readFile(sourceFile, "utf8"));
    if (!validPinnedSource(pinned))
      throw new Error("Pinned source identity is invalid");
    const targetPath = `.obsidian-publish/hosted/${namespace}/pinned.json`;
    await saveProtectedReport(targetPath, pinned, targetWorkspace);
    if (process.env.GITHUB_OUTPUT)
      await import("node:fs/promises").then(({ appendFile }) =>
        appendFile(
          process.env.GITHUB_OUTPUT,
          `source_unavailable=false\npinned_source=${targetPath}\nrevision=${pinned.revision}\n`,
        ),
      );
    return {
      version: 1,
      target: namespace,
      sourceUnavailable: false,
      source: pinned.revision,
      pinnedSource: targetPath,
    };
  } finally {
    transport.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      bootstrap: { type: "boolean", default: false },
      account: { type: "string", default: accountDefault },
    },
  });
  const result = await pinWorkflowSource({
    mode: values.mode,
    pr: values.pr ? Number(values.pr) : undefined,
    bootstrap: values.bootstrap,
    account: values.account,
  });
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error("Trusted private source pin failed");
    process.exitCode = 1;
  });
