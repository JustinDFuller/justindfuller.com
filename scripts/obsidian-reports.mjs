import { lstat, mkdir, open } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { targetNamespace } from "./obsidian-transaction.mjs";
import { protectedPublicationReport } from "./record-obsidian-publication.mjs";

export async function readProtectedReport(store, mode, pr) {
  const target = targetNamespace(mode, pr);
  if (target === "local") throw new Error("Hosted report target required");
  const raw = await store.get(`reports/${target}.json`, 2 * 1024 * 1024);
  if (!raw || raw.byteLength > 2 * 1024 * 1024)
    throw new Error("Protected report unavailable");
  const report = JSON.parse(Buffer.from(raw).toString("utf8"));
  if (
    report.version !== 1 ||
    report.target !== target ||
    typeof report.reportedAt !== "string" ||
    !Number.isFinite(Date.parse(report.reportedAt)) ||
    new Date(report.reportedAt).toISOString() !== report.reportedAt ||
    !/^[a-f0-9]{40}$/.test(report.codeSha ?? "") ||
    [report.source, report.code, report.digest].some(
      (value) => !/^[a-f0-9]{64}$/.test(value ?? ""),
    ) ||
    !Array.isArray(report.issues) ||
    report.issues.some(
      (issue) =>
        !/^[a-f0-9]{64}$/.test(issue?.key ?? "") ||
        !/^[a-z_]+$/.test(issue?.category ?? ""),
    )
  )
    throw new Error("Invalid protected report");
  const candidate = { ...report, state: { mode } };
  const sanitized = protectedPublicationReport(
    candidate,
    target,
    report.status,
    { ...report, mode },
    report.receipt,
  );
  sanitized.reportedAt = report.reportedAt;
  return sanitized;
}

export async function saveProtectedReport(path, report, cwd = process.cwd()) {
  const root = resolve(cwd, ".obsidian-publish"),
    file = resolve(cwd, path);
  if (!file.startsWith(`${root}/`) || file === root)
    throw new Error("Ignored private report output required");
  const parts = relative(cwd, file).split("/");
  let current = resolve(cwd);
  for (const part of parts) {
    current = resolve(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error("Linked report output denied");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const output = await open(
    file,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await output.chmod(0o600);
    await output.writeFile(`${JSON.stringify(report)}\n`);
  } finally {
    await output.close();
  }
}
