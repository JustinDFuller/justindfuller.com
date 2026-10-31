import { execFile as execFileCallback } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
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

export const noPreviewNotice =
  "::notice title=No private preview yet::No private preview exists for this pull request yet. Run the workflow manually with publish kind preview, this pull request number and bootstrap to create one.";

export const pinFailureReasons = [
  "invalid_target",
  "state_store_unreachable",
  "accepted_state_unavailable",
  "accepted_state_invalid",
  "accepted_state_incompatible",
  "source_pin_failed",
  "pinned_source_unreadable",
  "pinned_source_invalid",
];

export class PinFailure extends Error {
  constructor(reason, details = {}) {
    super("Trusted private source pin failed");
    this.name = "PinFailure";
    this.reason = pinFailureReasons.includes(reason) ? reason : "unknown";
    this.details = details;
  }
}

export function pinFailureSummary(error) {
  if (!(error instanceof PinFailure)) return { reason: "unknown" };
  return { ...error.details, reason: error.reason };
}

function pinProcessDetails(error) {
  return {
    exitCode: Number.isInteger(error?.code) ? error.code : -1,
    timedOut: error?.killed === true && error?.signal === "SIGTERM",
    signaled: typeof error?.signal === "string" && error.signal.length > 0,
  };
}

export function acceptedStateForPin(value, namespace, mode, bootstrap) {
  if (!value) {
    if (bootstrap) return undefined;
    throw new PinFailure("accepted_state_unavailable");
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
    throw new PinFailure("accepted_state_incompatible");
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
  skipIfMissing = false,
  account = accountDefault,
  cwd = process.cwd(),
  targetWorkspace = process.env.GITHUB_WORKSPACE ?? resolve(cwd, ".."),
  execute = execFile,
  transportFactory = environmentTransport,
}) {
  let namespace;
  try {
    namespace = targetNamespace(mode, pr);
  } catch {
    throw new PinFailure("invalid_target");
  }
  if (
    namespace === "local" ||
    !/^[a-f0-9]{32}$/.test(account) ||
    (skipIfMissing && mode !== "preview")
  )
    throw new PinFailure("invalid_target");
  let transport;
  try {
    transport = transportFactory("OBSIDIAN_STATE");
  } catch {
    throw new PinFailure("state_store_unreachable");
  }
  try {
    const store = new PrivateR2Store(
      transport,
      r2Target(account, "justindfuller-obsidian-state"),
    );
    let acceptedBytes;
    try {
      acceptedBytes = await store.get(
        `accepted/${namespace}/current.json`,
        64 * 1024 * 1024,
      );
    } catch {
      throw new PinFailure("state_store_unreachable");
    }
    let accepted;
    try {
      accepted = acceptedBytes
        ? JSON.parse(Buffer.from(acceptedBytes).toString("utf8"))
        : undefined;
    } catch {
      throw new PinFailure("accepted_state_invalid");
    }
    if (!accepted && skipIfMissing && !bootstrap) {
      console.log(noPreviewNotice);
      if (process.env.GITHUB_OUTPUT)
        await appendFile(process.env.GITHUB_OUTPUT, "no_preview=true\n");
      return { version: 1, target: namespace, noPreview: true };
    }
    const state = acceptedStateForPin(accepted, namespace, mode, bootstrap),
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
      throw new PinFailure("source_pin_failed", pinProcessDetails(error));
    }
    let pinnedText;
    try {
      pinnedText = await readFile(sourceFile, "utf8");
    } catch {
      throw new PinFailure("pinned_source_unreadable");
    }
    let pinned;
    try {
      pinned = JSON.parse(pinnedText);
    } catch {
      throw new PinFailure("pinned_source_invalid");
    }
    if (!validPinnedSource(pinned))
      throw new PinFailure("pinned_source_invalid");
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
      "skip-if-missing": { type: "boolean", default: false },
      account: { type: "string", default: accountDefault },
    },
  });
  const result = await pinWorkflowSource({
    mode: values.mode,
    pr: values.pr ? Number(values.pr) : undefined,
    bootstrap: values.bootstrap,
    skipIfMissing: values["skip-if-missing"],
    account: values.account,
  });
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch((error) => {
    console.error("Trusted private source pin failed");
    console.error(JSON.stringify(pinFailureSummary(error)));
    process.exitCode = 1;
  });
