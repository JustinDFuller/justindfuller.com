import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  PrivateR2Store,
  r2Target,
  environmentTransport,
} from "../tools/obsidian-image-publisher/src/publication.ts";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  readProtectedReport,
  saveProtectedReport,
} from "./obsidian-reports.mjs";

export function archiveKey(target, pr, run, checksum) {
  const namespace = targetNamespace(target, pr);
  if (
    !["staging", "preview"].includes(target) ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run) ||
    !/^[a-f0-9]{64}$/.test(checksum)
  )
    throw new Error("Invalid private archive identity");
  return `artifacts/${namespace}/${run}/${checksum}.tar`;
}

export async function archiveTransfer(store, operation, key, bytes, checksum) {
  if (
    !["upload", "download"].includes(operation) ||
    !(
      key.startsWith("artifacts/") ||
      /^rollback\/artifacts\/(production|staging|pr\/[1-9][0-9]*)\/[a-f0-9]{64}\.tar$/.test(
        key,
      )
    ) ||
    !/^[a-f0-9]{64}$/.test(checksum)
  )
    throw new Error("Invalid private archive operation");
  if (operation === "upload") {
    if (createHash("sha256").update(bytes).digest("hex") !== checksum)
      throw new Error("Tested archive checksum differs");
    const prior = await store.get(key, 256 * 1024 * 1024);
    if (prior && !Buffer.from(prior).equals(bytes))
      throw new Error("Immutable archive already differs");
    if (!prior) await store.put(key, bytes, true);
  }
  const verified = await store.get(key, 256 * 1024 * 1024);
  if (
    !verified ||
    createHash("sha256").update(verified).digest("hex") !== checksum
  )
    throw new Error("Private archive checksum verification failed");
  return verified;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: "string" },
      pr: { type: "string" },
      run: { type: "string" },
      checksum: { type: "string" },
      file: { type: "string" },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    },
  });
  const [operation] = positionals;
  targetNamespace(values.target, values.pr ? Number(values.pr) : undefined);
  if (
    !values.file ||
    !resolve(values.file).startsWith(`${resolve(".obsidian-publish")}/`)
  )
    throw new Error("Private output must be in ignored local storage");
  const transport = environmentTransport(
    operation === "report" ? "OBSIDIAN_REPORT" : "OBSIDIAN_STATE",
  );
  const store = new PrivateR2Store(
    transport,
    r2Target(values.account, "justindfuller-obsidian-state"),
  );
  try {
    let bytes;
    let report;
    if (operation === "report") {
      report = await readProtectedReport(
        store,
        values.target,
        values.pr ? Number(values.pr) : undefined,
      );
      bytes = Buffer.from(JSON.stringify(report));
      await saveProtectedReport(values.file, report);
    } else {
      const key = archiveKey(
        values.target,
        values.pr ? Number(values.pr) : undefined,
        values.run,
        values.checksum,
      );
      bytes = await archiveTransfer(
        store,
        operation,
        key,
        operation === "upload" ? readFileSync(values.file) : undefined,
        values.checksum,
      );
    }
    if (!report) {
      mkdirSync(dirname(values.file), { recursive: true, mode: 0o700 });
      writeFileSync(values.file, bytes, { mode: 0o600 });
    }
    console.log(
      JSON.stringify({
        status: "verified",
        operation,
        target: values.target,
        publicationStatus: report?.status,
        bytes: bytes.length,
        ...store.counters,
      }),
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
      "Private storage operation failed; inspect protected storage and credentials",
    );
    process.exitCode = 1;
  });
