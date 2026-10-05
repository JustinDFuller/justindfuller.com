import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CloudflareServing } from "./obsidian-cloudflare.mjs";
import { readPrivatePreparation } from "./prepare-obsidian-target.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";

export async function targetRecoveryNeedsDeployment(
  journal,
  namespace,
  live,
  candidateMatches,
) {
  if (
    journal?.namespace !== namespace ||
    !/^(?:production|staging|pr\/[1-9][0-9]*)$/.test(namespace ?? "") ||
    ["promoted", "rolled_back"].includes(journal.phase) ||
    live === journal.prior?.identity ||
    (journal.phase === "verified" && journal.receipt?.deployment === live)
  )
    return false;
  return Boolean(
    journal.candidate && (await candidateMatches(journal.candidate)),
  );
}

export async function previewRecoveryNeedsDeployment(
  journal,
  live,
  candidateMatches,
) {
  if (!/^pr\/[1-9][0-9]*$/.test(journal?.namespace ?? "")) return false;
  return targetRecoveryNeedsDeployment(
    journal,
    journal.namespace,
    live,
    candidateMatches,
  );
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      access: { type: "string" },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    },
  });
  const pr = values.pr ? Number(values.pr) : undefined,
    namespace = targetNamespace(values.mode, pr),
    transport = environmentTransport("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
        transport,
        r2Target(values.account, "justindfuller-obsidian-state"),
      ),
      serving = new CloudflareServing({
        account: values.account,
        mode: values.mode,
        pr,
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
      }),
      bytes = await store.get(
        `journals/${namespace}/pending.json`,
        64 * 1024 * 1024,
      ),
      journal = bytes
        ? JSON.parse(Buffer.from(bytes).toString("utf8"))
        : undefined;
    let requiresFrontendDependencies = false;
    if (journal) {
      const live = await serving.identity();
      requiresFrontendDependencies = await targetRecoveryNeedsDeployment(
        journal,
        namespace,
        live,
        (candidate) => serving.matchesCandidate(candidate, live),
      );
    }
    console.log(
      JSON.stringify({
        version: 1,
        target: namespace,
        requiresFrontendDependencies,
      }),
    );
    if (process.env.GITHUB_OUTPUT)
      await import("node:fs/promises").then(({ appendFile }) =>
        appendFile(
          process.env.GITHUB_OUTPUT,
          `requires_frontend=${requiresFrontendDependencies}\n`,
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
    console.error("Private recovery status could not be verified");
    process.exitCode = 1;
  });
