import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readCodeValidation,
  validatePublicationCode,
} from "./obsidian-workflow.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";

const execFile = promisify(execFileCallback);
const account = "9dce34804a27754a4ea66a5789827dfa";

async function command(program, args, cwd = process.cwd()) {
  try {
    await execFile(program, args, {
      cwd,
      env: publicationEnvironment(process.env, "build"),
      maxBuffer: 32 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
    });
  } catch {
    throw new Error("Required main-code validation failed");
  }
}

export async function runCodeValidation({
  codeSha,
  run,
  cwd = process.cwd(),
  transportFactory = environmentTransport,
}) {
  if (
    !/^[a-f0-9]{40}$/.test(codeSha ?? "") ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run ?? "")
  )
    throw new Error("Exact main validation identity required");
  const checkout = await execFile("git", ["rev-parse", "HEAD"], {
    cwd,
    env: publicationEnvironment(process.env, "build"),
  });
  if (checkout.stdout.trim() !== codeSha)
    throw new Error("Validation checkout differs from main code");
  const transport = transportFactory("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
      transport,
      r2Target(account, "justindfuller-obsidian-state"),
    );
    return await validatePublicationCode(
      store,
      { codeSha, run },
      async (check) => {
        switch (check) {
          case "go-tests":
            await command("go", ["test", "./..."], cwd);
            break;
          case "node-tests": {
            const files = [
              ...(await readdir(resolve(cwd, "scripts")))
                .filter((name) => name.endsWith(".test.mjs"))
                .map((name) => `scripts/${name}`),
              ...(
                await readdir(
                  resolve(cwd, "tools/obsidian-image-publisher/tests"),
                )
              )
                .filter((name) => name.endsWith(".test.ts"))
                .map((name) => `tools/obsidian-image-publisher/tests/${name}`),
            ];
            await command("node", ["--test", ...files], cwd);
            break;
          }
          case "publisher-types":
            await command(
              "tools/obsidian-image-publisher/node_modules/.bin/tsc",
              ["-p", "tools/obsidian-image-publisher", "--noEmit"],
              cwd,
            );
            break;
          case "script-lint":
            await command(
              "node_modules/.bin/eslint",
              ["-c", "eslint.config.mjs", "--quiet", "scripts"],
              cwd,
            );
            break;
          case "production-export":
            await command(
              "npm",
              ["run", "build:cloudflare", "--", "--mode", "production"],
              cwd,
            );
            break;
          case "staging-export":
            await command(
              "npm",
              ["run", "build:cloudflare", "--", "--mode", "staging"],
              cwd,
            );
            break;
          case "production-dry-run":
            await command(
              "node_modules/.bin/cf",
              ["deploy", "--prebuilt", "--mode", "production", "--dry-run"],
              cwd,
            );
            break;
          case "staging-dry-run":
            await command(
              "node_modules/.bin/cf",
              ["deploy", "--prebuilt", "--mode", "staging", "--dry-run"],
              cwd,
            );
            break;
          default:
            throw new Error("Unknown main-code validation check");
        }
        return true;
      },
    );
  } finally {
    transport.close();
  }
}

export async function probeCodeValidation({
  codeSha,
  transportFactory = environmentTransport,
}) {
  if (!/^[a-f0-9]{40}$/.test(codeSha ?? ""))
    throw new Error("Exact main validation identity required");
  const transport = transportFactory("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
      transport,
      r2Target(account, "justindfuller-obsidian-state"),
    );
    return await readCodeValidation(store, codeSha);
  } finally {
    transport.close();
  }
}

async function main() {
  if (process.argv.includes("--probe")) {
    const receipt = await probeCodeValidation({
      codeSha: process.env.OBSIDIAN_CODE_SHA,
    });
    console.log(JSON.stringify({ version: 1, reusable: Boolean(receipt) }));
    if (process.env.GITHUB_OUTPUT)
      await import("node:fs/promises").then(({ appendFile }) =>
        appendFile(
          process.env.GITHUB_OUTPUT,
          `reusable=${receipt ? "true" : "false"}\n`,
        ),
      );
    return;
  }
  const result = await runCodeValidation({
    codeSha: process.env.OBSIDIAN_CODE_SHA,
    run: `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`,
  });
  console.log(
    JSON.stringify({
      version: 1,
      status: result.skipped ? "receipt-reused" : "validated",
      codeSha: result.receipt.codeSha,
      policy: result.receipt.policy,
      completedAt: result.receipt.completedAt,
    }),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error("Main-code receipt is unavailable or validation failed");
    process.exitCode = 1;
  });
