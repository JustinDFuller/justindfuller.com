export type PublicationReport = {
  version: 1;
  target: "production" | "staging";
  source: string;
  status: "verified" | "degraded" | "failed" | "queued";
  issues: { key: string; category: string }[];
  verifiedAt?: string;
};
export type NoticeState = Record<string, string[]>;
export type PublicationTarget = "staging" | "production";
export type PublicationStatus = PublicationReport["status"] | "uploaded";
export type PublicationStatusState = Partial<
  Record<PublicationTarget, { source: string; status: PublicationStatus }>
>;

export function publicationNotices(
  report: PublicationReport,
  state: NoticeState,
): { state: NoticeState; notices: string[] } {
  if (
    report.version !== 1 ||
    !["staging", "production"].includes(report.target) ||
    !/^[a-f0-9]{64}$/.test(report.source) ||
    !["verified", "degraded", "failed", "queued"].includes(report.status) ||
    !Array.isArray(report.issues) ||
    report.issues.length > 10000
  )
    throw new Error("Invalid protected publication report");
  const issues = report.issues
    .map((issue) => {
      if (
        !/^[a-f0-9]{64}$/.test(issue.key) ||
        !/^[a-z_]+$/.test(issue.category)
      )
        throw new Error("Invalid protected issue");
      return `${issue.key}:${issue.category}`;
    })
    .sort();
  const uniqueIssues = [...new Set(issues)];
  const previous = state[report.target] ?? [];
  const notices = uniqueIssues
    .filter((issue) => !previous.includes(issue))
    .map((issue) => `${report.target}: ${issue.split(":")[1]}`);
  if (
    previous.length &&
    uniqueIssues.length === 0 &&
    report.status === "verified"
  )
    notices.push(`${report.target}: publication recovered`);
  const next = { ...state };
  if (
    report.status === "verified" ||
    ((report.status === "degraded" || report.status === "failed") &&
      uniqueIssues.length > 0)
  )
    next[report.target] = uniqueIssues;
  return { state: next, notices };
}

export function queuedPublication(
  revision: string,
  status: "uploaded" | "queued",
  previous: PublicationStatusState,
): PublicationStatusState {
  if (!/^[a-f0-9]{64}$/.test(revision))
    throw new Error("Invalid publication revision");
  const next = { ...previous };
  for (const target of ["staging", "production"] as const)
    next[target] = { source: revision, status };
  return next;
}

export function observePublication(
  report: PublicationReport,
  revision: string | undefined,
  previous: PublicationStatusState,
  issues: NoticeState,
): { status: PublicationStatusState; issues: NoticeState; notices: string[] } {
  const observed = publicationNotices(report, issues);
  if (revision && report.source !== revision)
    return (report.status === "failed" || report.status === "degraded") &&
      report.issues.length > 0
      ? { status: previous, issues: observed.state, notices: observed.notices }
      : { status: previous, issues, notices: [] };
  const old = previous[report.target],
    status = {
      ...previous,
      [report.target]: { source: report.source, status: report.status },
    };
  const notices = [...observed.notices];
  if (old?.source !== report.source || old?.status !== report.status)
    notices.push(`${report.target}: publication ${report.status}`);
  return { status, issues: observed.state, notices };
}

export async function readPublicationReport(
  store: { get(key: string, limit: number): Promise<Uint8Array | undefined> },
  target: PublicationTarget,
): Promise<PublicationReport> {
  if (!["staging", "production"].includes(target))
    throw new Error("Invalid report target");
  const raw = await store.get(`reports/${target}.json`, 2 * 1024 * 1024);
  if (!raw || raw.byteLength > 2 * 1024 * 1024)
    throw new Error("Protected publication report unavailable");
  const report = JSON.parse(
    Buffer.from(raw).toString("utf8"),
  ) as PublicationReport;
  if (report.target !== target) throw new Error("Report target mismatch");
  publicationNotices(report, {});
  return report;
}

export async function readPublicationReports(
  store: { get(key: string, limit: number): Promise<Uint8Array | undefined> },
  onReport: (
    target: PublicationTarget,
    report: PublicationReport,
  ) => Promise<void>,
  onUnavailable: (target: PublicationTarget) => Promise<void>,
): Promise<void> {
  await Promise.all(
    (["staging", "production"] as const).map(async (target) => {
      try {
        await onReport(target, await readPublicationReport(store, target));
      } catch {
        await onUnavailable(target);
      }
    }),
  );
}

export function publicationStatusSummary(
  state: PublicationStatusState,
  unavailable: Partial<Record<PublicationTarget, boolean>> = {},
): string {
  return (["staging", "production"] as const)
    .map(
      (target) =>
        `${target}: ${unavailable[target] ? "status unavailable" : (state[target]?.status ?? "awaiting a protected report")}`,
    )
    .join("; ");
}
