import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isBlockingCategory } from "./prepare-obsidian-target.mjs";

const safeTarget = /^(production|staging|pr\/[1-9][0-9]*)$/;
const safeCategory = /^[a-z][a-z_]{0,63}$/;
const decisions = new Set([
  "candidate",
  "retain-serving",
  "skip-build",
  "build-required",
]);
const count = (value) => Number.isSafeInteger(value) && value >= 0;

export function publicIssueOutput(result) {
  const summary = result?.issueSummary,
    entries = Object.entries(summary?.categories ?? {});
  if (
    !safeTarget.test(result?.target ?? "") ||
    !decisions.has(result?.decision) ||
    !count(summary?.files) ||
    !count(summary?.blocking) ||
    summary.blocking > summary.files ||
    summary.blocking > 0 !==
      entries.some(([category]) => isBlockingCategory(category)) ||
    !/^([a-f0-9]{64})?$/.test(result.handoff?.checksum ?? "") ||
    entries.some(
      ([category, files]) =>
        !safeCategory.test(category) || !count(files) || files < 1,
    )
  )
    throw new Error("Invalid preparation issue summary");
  const text = entries.length
    ? `${result.target}: ${summary.files} ${summary.files === 1 ? "file" : "files"} with issues (${entries
        .map(([category, files]) => `${category}: ${files}`)
        .join(", ")})`
    : undefined;
  return {
    outputs: {
      decision: result.decision,
      handoff: result.handoff?.checksum ?? "",
      blocking: String(summary.blocking),
      categories: JSON.stringify(summary.categories),
    },
    annotation: text
      ? `::warning title=Obsidian publication issues::${text}`
      : undefined,
    summaryLine: text ? `- ${text}\n` : undefined,
  };
}

function main() {
  const { values } = parseArgs({ options: { result: { type: "string" } } });
  const output = publicIssueOutput(
    JSON.parse(readFileSync(resolve(values.result ?? ""), "utf8")),
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(output.outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join(""),
  );
  if (output.annotation) {
    console.log(output.annotation);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, output.summaryLine);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  try {
    main();
  } catch {
    console.error("Preparation issue summary unavailable");
    process.exitCode = 1;
  }
