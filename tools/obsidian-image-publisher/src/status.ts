export type PublicationReport = {
  version: 1;
  target: "production" | "staging";
  source: string;
  status: "verified" | "degraded" | "failed" | "queued";
  issues: { key: string; category: string }[];
  verifiedAt?: string;
};
export type NoticeState = Record<string, string[]>;

export function publicationNotices(
  report: PublicationReport,
  state: NoticeState,
): { state: NoticeState; notices: string[] } {
  if (
    report.version !== 1 ||
    !["staging", "production"].includes(report.target) ||
    !/^[a-f0-9]{64}$/.test(report.source) ||
    !["verified", "degraded", "failed", "queued"].includes(report.status) ||
    !Array.isArray(report.issues)
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
  const previous = state[report.target] ?? [];
  const notices = issues
    .filter((issue) => !previous.includes(issue))
    .map((issue) => `${report.target}: ${issue.split(":")[1]}`);
  if (previous.length && issues.length === 0 && report.status === "verified")
    notices.push(`${report.target}: publication recovered`);
  const next = { ...state };
  if (
    report.status === "verified" ||
    report.status === "degraded" ||
    report.status === "failed"
  )
    next[report.target] = issues;
  return { state: next, notices };
}
