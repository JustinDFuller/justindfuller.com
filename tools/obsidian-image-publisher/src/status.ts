export type PublicationReport = {
  version: 1;
  target: "production" | "staging";
  source: string;
  status: "verified" | "degraded" | "failed" | "queued";
  issues: { key: string; category: string; path?: string; reason?: string }[];
  verifiedAt?: string;
};
export type NoticeState = Record<string, string[]>;
export type PublicationTarget = "staging" | "production";
export type UnresolvedIssue = {
  key: string;
  category: string;
  path: string;
  reason: string;
  dismissed: boolean;
};
export type IssueState = Partial<Record<PublicationTarget, UnresolvedIssue[]>>;
export type MergedIssue = {
  id: string;
  path: string;
  reason: string;
  targets: PublicationTarget[];
  dismissed: boolean;
};
const targets = ["staging", "production"] as const;
const maxReason = 500;
const maxPath = 1024;
const controlCharacters = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const blockingCategories = [
  "last_known_good",
  "route_collision",
  "overwrite_target",
];
export type PublicationStatus = PublicationReport["status"] | "uploaded";
export type PublicationStatusState = Partial<
  Record<PublicationTarget, { source: string; status: PublicationStatus }>
>;

export const isBlockingCategory = (category: string): boolean =>
  category.startsWith("markdown_") || blockingCategories.includes(category);

const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= limit &&
  !controlCharacters.test(value);

const validPath = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxPath;

const displayPath = (value: string): string =>
  value.replace(/\p{Cc}+/gu, " ").trim() || "an unknown note";

const replacesIssues = (report: PublicationReport): boolean =>
  report.status === "verified" ||
  ((report.status === "degraded" || report.status === "failed") &&
    report.issues.length > 0);

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
        !/^[a-z_]+$/.test(issue.category) ||
        (issue.path !== undefined && !validPath(issue.path)) ||
        (issue.reason !== undefined && !validText(issue.reason, maxReason))
      )
        throw new Error("Invalid protected issue");
      return `${issue.key}:${issue.category}`;
    })
    .sort();
  const uniqueIssues = [...new Set(issues)];
  const previous = state[report.target] ?? [];
  const notices = uniqueIssues
    .filter(
      (issue) =>
        !previous.includes(issue) && !isBlockingCategory(issue.split(":")[1]),
    )
    .map((issue) => `${report.target}: ${issue.split(":")[1]}`);
  if (
    previous.length &&
    uniqueIssues.length === 0 &&
    report.status === "verified"
  )
    notices.push(`${report.target}: publication recovered`);
  const next = { ...state };
  if (replacesIssues(report)) next[report.target] = uniqueIssues;
  return { state: next, notices };
}

export function trackUnresolved(
  report: PublicationReport,
  previous: IssueState,
): IssueState {
  if (!replacesIssues(report)) return previous;
  if (report.issues.some((issue) => issue.category === "source_degraded"))
    return previous;
  const prior = new Map(
      (previous[report.target] ?? []).map((issue) => [issue.key, issue]),
    ),
    entries = new Map<string, UnresolvedIssue>(),
    elsewhere = targets
      .filter((target) => target !== report.target)
      .flatMap((target) => previous[target] ?? [])
      .filter((issue) => issue.dismissed);
  for (const issue of report.issues) {
    if (!isBlockingCategory(issue.category) || entries.has(issue.key)) continue;
    const reason = issue.reason ?? issue.category.replaceAll("_", " "),
      path = displayPath(issue.path ?? ""),
      before = prior.get(issue.key);
    entries.set(issue.key, {
      key: issue.key,
      category: issue.category,
      path,
      reason,
      dismissed:
        before !== undefined
          ? before.dismissed && before.reason === reason
          : elsewhere.some(
              (other) =>
                other.key === issue.key &&
                other.path === path &&
                other.reason === reason,
            ),
    });
  }
  if (report.status === "failed")
    for (const [key, issue] of prior)
      if (
        !entries.has(key) &&
        ![...entries.values()].some(
          (entry) => entry.path === issue.path && entry.reason === issue.reason,
        )
      )
        entries.set(key, issue);
  const paths = new Map<string, number>();
  for (const issue of entries.values())
    paths.set(issue.path, (paths.get(issue.path) ?? 0) + 1);
  return {
    ...previous,
    [report.target]: [...entries.values()].filter(
      (issue) =>
        issue.category !== "last_known_good" || paths.get(issue.path) === 1,
    ),
  };
}

export function mergedIssues(state: IssueState): MergedIssue[] {
  const merged = new Map<string, MergedIssue & { all: boolean }>();
  for (const target of targets)
    for (const issue of state[target] ?? []) {
      const id = JSON.stringify([issue.path, issue.reason]),
        found = merged.get(id);
      if (found) {
        if (!found.targets.includes(target)) found.targets.push(target);
        found.all &&= issue.dismissed;
      } else
        merged.set(id, {
          id,
          path: issue.path,
          reason: issue.reason,
          targets: [target],
          dismissed: issue.dismissed,
          all: issue.dismissed,
        });
    }
  return [...merged.values()]
    .map(({ all, ...issue }) => ({ ...issue, dismissed: all }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function dismissIssue(state: IssueState, id: string): IssueState {
  const next: IssueState = {};
  for (const target of targets)
    if (state[target])
      next[target] = state[target].map((issue) =>
        JSON.stringify([issue.path, issue.reason]) === id
          ? { ...issue, dismissed: true }
          : issue,
      );
  return next;
}

export function readStoredIssues(value: unknown): IssueState {
  const state: IssueState = {};
  if (typeof value !== "object" || value === null) return state;
  for (const target of targets) {
    const list = (value as Record<string, unknown>)[target];
    if (!Array.isArray(list)) continue;
    state[target] = list.filter(
      (issue): issue is UnresolvedIssue =>
        typeof issue === "object" &&
        issue !== null &&
        /^[a-f0-9]{64}$/.test(issue.key) &&
        /^[a-z_]+$/.test(issue.category) &&
        validPath(issue.path) &&
        validText(issue.reason, maxReason) &&
        typeof issue.dismissed === "boolean",
    );
  }
  return state;
}

export const issueSummary = (issue: MergedIssue): string =>
  `${issue.path}: ${issue.reason}. Still serving the previous version on ${issue.targets.join(" and ")}.`;

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
  unresolved: IssueState = {},
): {
  status: PublicationStatusState;
  issues: NoticeState;
  unresolved: IssueState;
  notices: string[];
} {
  const observed = publicationNotices(report, issues),
    tracked = trackUnresolved(report, unresolved),
    recovered = [...observed.notices];
  if (
    (unresolved[report.target]?.length ?? 0) > 0 &&
    tracked[report.target]?.length === 0 &&
    !recovered.includes(`${report.target}: publication recovered`)
  )
    recovered.push(`${report.target}: publication recovered`);
  if (revision && report.source !== revision)
    return (report.status === "failed" || report.status === "degraded") &&
      report.issues.length > 0
      ? {
          status: previous,
          issues: observed.state,
          unresolved: tracked,
          notices: recovered,
        }
      : { status: previous, issues, unresolved, notices: [] };
  const old = previous[report.target],
    status = {
      ...previous,
      [report.target]: { source: report.source, status: report.status },
    };
  const notices = [...recovered];
  if (old?.source !== report.source || old?.status !== report.status)
    notices.push(`${report.target}: publication ${report.status}`);
  return { status, issues: observed.state, unresolved: tracked, notices };
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
