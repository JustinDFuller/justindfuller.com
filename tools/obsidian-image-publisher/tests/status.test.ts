import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observePublication,
  queuedPublication,
  publicationNotices,
  readPublicationReport,
  readPublicationReports,
  publicationStatusSummary,
  trackUnresolved,
  mergedIssues,
  dismissIssue,
  readStoredIssues,
  issueSummary,
  isBlockingCategory,
  type IssueState,
  type PublicationReport,
} from "../src/status.ts";

const source = "a".repeat(64),
  issue = "b".repeat(64);
const report = (
  target: "staging" | "production",
  status: PublicationReport["status"],
): PublicationReport => ({
  version: 1,
  target,
  source,
  status,
  issues:
    status === "failed" ? [{ key: issue, category: "deployment_failed" }] : [],
});

test("uploaded, queued and target outcomes remain distinct across restarts and stale reports", () => {
  const uploaded = queuedPublication(source, "uploaded", {}),
    queued = queuedPublication(source, "queued", uploaded);
  assert.equal(uploaded.production?.status, "uploaded");
  assert.equal(queued.production?.status, "queued");
  const failed = observePublication(
    report("production", "failed"),
    source,
    queued,
    {},
  );
  const restart = JSON.parse(JSON.stringify(failed.status));
  const staging = observePublication(
    report("staging", "verified"),
    source,
    restart,
    failed.issues,
  );
  assert.equal(staging.status.staging?.status, "verified");
  assert.equal(staging.status.production?.status, "failed");
  assert.equal(
    publicationStatusSummary(staging.status),
    "staging: verified; production: failed",
  );
  assert.equal(
    publicationStatusSummary(staging.status, { production: true }),
    "staging: verified; production: status unavailable",
  );
  assert.deepEqual(staging.issues.production, failed.issues.production);
  const retry = observePublication(
    report("production", "failed"),
    source,
    staging.status,
    staging.issues,
  );
  assert.deepEqual(retry.notices, []);
  const stale = observePublication(
    { ...report("production", "verified"), source: "c".repeat(64) },
    source,
    retry.status,
    retry.issues,
  );
  assert.deepEqual(stale.status, retry.status);
  assert.deepEqual(stale.issues, retry.issues);
  assert.deepEqual(stale.notices, []);
  const recovery = observePublication(
    report("production", "verified"),
    source,
    stale.status,
    stale.issues,
  );
  assert.equal(recovery.status.production?.status, "verified");
  assert.ok(recovery.notices.includes("production: publication recovered"));
});

test("failed or queued reports cannot clear issue state without verified recovery", () => {
  const failed = publicationNotices(report("production", "failed"), {});
  for (const status of ["failed", "degraded", "queued"] as const) {
    const next = publicationNotices(
      { ...report("production", status), issues: [] },
      failed.state,
    );
    assert.deepEqual(next.state.production, failed.state.production);
    assert.deepEqual(next.notices, []);
  }
  const degraded = observePublication(
    report("staging", "degraded"),
    source,
    {},
    {},
  );
  assert.deepEqual(degraded.notices, ["staging: publication degraded"]);
  assert.deepEqual(
    observePublication(
      report("staging", "degraded"),
      source,
      degraded.status,
      degraded.issues,
    ).notices,
    [],
  );
  const pending = queuedPublication(source, "queued", {});
  const blocked = observePublication(
    { ...report("production", "failed"), source: "f".repeat(64) },
    source,
    pending,
    {},
  );
  assert.equal(blocked.status.production?.status, "queued");
  assert.deepEqual(blocked.notices, ["production: deployment_failed"]);
});

test("duplicate issue fingerprints in one report produce one notice", () => {
  const duplicate = report("production", "failed");
  duplicate.issues = [
    { key: issue, category: "deployment_failed" },
    { key: issue, category: "deployment_failed" },
  ];
  const observed = publicationNotices(duplicate, {});
  assert.deepEqual(observed.notices, ["production: deployment_failed"]);
  assert.deepEqual(observed.state.production, [
    "b".repeat(64) + ":deployment_failed",
  ]);
});

test("protected status reads validate target, limits and issue fingerprints", async () => {
  let requested = "";
  const store = {
    get: async (key: string, limit: number) => {
      requested = key;
      assert.equal(limit, 2 * 1024 * 1024);
      return Buffer.from(JSON.stringify(report("production", "verified")));
    },
  };
  assert.equal(
    (await readPublicationReport(store, "production")).status,
    "verified",
  );
  assert.equal(requested, "reports/production.json");
  await assert.rejects(
    readPublicationReport(store, "staging"),
    /target mismatch/,
  );
  await assert.rejects(
    readPublicationReport({ get: async () => undefined }, "production"),
    /unavailable/,
  );
  await assert.rejects(
    readPublicationReport(
      { get: async () => Buffer.alloc(2 * 1024 * 1024 + 1) },
      "production",
    ),
    /unavailable/,
  );
  assert.throws(
    () =>
      publicationNotices(
        {
          ...report("production", "failed"),
          issues: [{ key: "private filename", category: "failure" }],
        },
        {},
      ),
    /protected issue/,
  );
  assert.throws(
    () =>
      publicationNotices(
        {
          ...report("production", "failed"),
          issues: Array.from({ length: 10001 }, () => ({
            key: issue,
            category: "failure",
          })),
        },
        {},
      ),
    /protected publication report/,
  );
});

test("pending protected reads yield control without delaying the other target", async () => {
  let finish: (value: Uint8Array) => void = () => {
    throw new Error("Read not started");
  };
  let stagingRead = false,
    productionRead = false,
    stagingComplete = false,
    productionComplete = false;
  const store = {
    get: async (_key: string, _limit: number) =>
      new Promise<Uint8Array>((resolve) => {
        finish = resolve;
      }),
  };
  const pending = readPublicationReports(
    {
      get: async (key, limit) => {
        assert.equal(limit, 2 * 1024 * 1024);
        if (key === "reports/production.json") {
          productionRead = true;
          return store.get(key, limit);
        }
        stagingRead = true;
        return Buffer.from(JSON.stringify(report("staging", "verified")));
      },
    },
    async (target, value) => {
      assert.equal(value.target, target);
      if (target === "staging") stagingComplete = true;
      else productionComplete = true;
    },
    async () => assert.fail("Both target reports should resolve"),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(stagingRead, true);
  assert.equal(productionRead, true);
  assert.equal(stagingComplete, true);
  assert.equal(productionComplete, false);
  finish(Buffer.from(JSON.stringify(report("production", "verified"))));
  await pending;
  assert.equal(productionComplete, true);
});

const fingerprint = (letter: string) => letter.repeat(64);
const rejected = (
  target: "staging" | "production",
  issues: PublicationReport["issues"],
  status: PublicationReport["status"] = "degraded",
): PublicationReport => ({ version: 1, target, source, status, issues });
const metadata = (key: string, path: string, reason?: string) => ({
  key: fingerprint(key),
  category: "markdown_metadata",
  path,
  ...(reason ? { reason } : {}),
});
const invalid = "environment must be one of nonprod, staging, production";

test("blocking categories are Markdown failures, last-known-good fallbacks, route collisions and overwrite conflicts", () => {
  for (const category of [
    "markdown_metadata",
    "markdown_link",
    "last_known_good",
    "route_collision",
    "overwrite_target",
  ])
    assert.equal(isBlockingCategory(category), true, category);
  for (const category of [
    "image_not_ready",
    "source_degraded",
    "deployment_failed",
    "image_missing",
  ])
    assert.equal(isBlockingCategory(category), false, category);
});

test("a blocking issue creates an unresolved entry with path, reason and fingerprint and no transient notice", () => {
  const observed = observePublication(
    rejected("staging", [metadata("c", "Blog/draft.md", invalid)]),
    source,
    {},
    {},
    {},
  );
  assert.deepEqual(observed.unresolved.staging, [
    {
      key: fingerprint("c"),
      category: "markdown_metadata",
      path: "Blog/draft.md",
      reason: invalid,
      dismissed: false,
    },
  ]);
  assert.deepEqual(observed.notices, ["staging: publication degraded"]);
  assert.deepEqual(mergedIssues(observed.unresolved), [
    {
      id: JSON.stringify(["Blog/draft.md", invalid]),
      path: "Blog/draft.md",
      reason: invalid,
      targets: ["staging"],
      dismissed: false,
    },
  ]);
});

test("non-blocking issues keep their transient notice and create no unresolved entry", () => {
  const observed = observePublication(
    rejected("staging", [
      { key: fingerprint("d"), category: "image_not_ready", path: "Blog/a.md" },
    ]),
    source,
    {},
    {},
    {},
  );
  assert.deepEqual(observed.unresolved.staging, []);
  assert.ok(observed.notices.includes("staging: image_not_ready"));
});

test("reports without a reason fall back to the category text", () => {
  const observed = trackUnresolved(
    rejected("production", [metadata("e", "Blog/old.md")]),
    {},
  );
  assert.equal(observed.production?.[0].reason, "markdown metadata");
  const noPath = trackUnresolved(
    rejected("production", [
      { key: fingerprint("f"), category: "route_collision" },
    ]),
    {},
  );
  assert.equal(noPath.production?.[0].path, "an unknown note");
  assert.equal(noPath.production?.[0].reason, "route collision");
});

test("identical issues in staging and production merge into one issue naming both targets", () => {
  let state: IssueState = {};
  state = trackUnresolved(
    rejected("production", [metadata("1", "Blog/draft.md", invalid)]),
    state,
  );
  state = trackUnresolved(
    rejected("staging", [metadata("2", "Blog/draft.md", invalid)]),
    state,
  );
  const merged = mergedIssues(state);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].targets, ["staging", "production"]);
  assert.equal(
    issueSummary(merged[0]),
    `Blog/draft.md: ${invalid}. Still serving the previous version on staging and production.`,
  );
  state = trackUnresolved(
    rejected("staging", [metadata("3", "Blog/draft.md", "different reason")]),
    state,
  );
  assert.equal(mergedIssues(state).length, 2);
});

test("duplicate fingerprints in one report produce one unresolved entry", () => {
  const state = trackUnresolved(
    rejected("staging", [
      metadata("4", "Blog/draft.md", invalid),
      metadata("4", "Blog/draft.md", invalid),
    ]),
    {},
  );
  assert.equal(state.staging?.length, 1);
});

test("dismissal holds while the fingerprint is unchanged and ends when the issue changes or recurs after recovery", () => {
  const first = rejected("staging", [metadata("5", "Blog/draft.md", invalid)]);
  let state = trackUnresolved(first, {});
  state = dismissIssue(state, mergedIssues(state)[0].id);
  assert.equal(mergedIssues(state)[0].dismissed, true);
  state = trackUnresolved(first, state);
  assert.equal(mergedIssues(state)[0].dismissed, true);
  const changed = trackUnresolved(
    rejected("staging", [
      metadata("5", "Blog/draft.md", "environment must not be blank"),
    ]),
    state,
  );
  assert.equal(mergedIssues(changed)[0].dismissed, false);
  const otherKey = trackUnresolved(
    rejected("staging", [metadata("6", "Blog/draft.md", invalid)]),
    state,
  );
  assert.equal(mergedIssues(otherKey)[0].dismissed, false);
  const recovered = trackUnresolved(rejected("staging", [], "verified"), state);
  assert.deepEqual(mergedIssues(recovered), []);
  const recurred = trackUnresolved(first, recovered);
  assert.equal(mergedIssues(recurred)[0].dismissed, false);
});

test("a merged issue is dismissed only when every target dismissed it, and dismissing clears both", () => {
  let state: IssueState = {};
  state = trackUnresolved(
    rejected("production", [metadata("1", "Blog/draft.md", invalid)]),
    state,
  );
  state = trackUnresolved(
    rejected("staging", [metadata("2", "Blog/draft.md", invalid)]),
    state,
  );
  state = dismissIssue(state, mergedIssues(state)[0].id);
  assert.equal(mergedIssues(state)[0].dismissed, true);
  assert.equal(state.staging?.[0].dismissed, true);
  assert.equal(state.production?.[0].dismissed, true);
  state = trackUnresolved(
    rejected("staging", [metadata("7", "Blog/draft.md", invalid)]),
    state,
  );
  assert.equal(mergedIssues(state)[0].dismissed, false);
});

test("recovery removes the entry only on a verified report and reports publication recovered", () => {
  const observed = observePublication(
    rejected("staging", [metadata("8", "Blog/draft.md", invalid)]),
    source,
    {},
    {},
    {},
  );
  const queued = observePublication(
    rejected("staging", [], "queued"),
    source,
    observed.status,
    observed.issues,
    observed.unresolved,
  );
  assert.equal(mergedIssues(queued.unresolved).length, 1);
  const failed = observePublication(
    rejected("staging", [], "failed"),
    source,
    queued.status,
    queued.issues,
    queued.unresolved,
  );
  assert.equal(mergedIssues(failed.unresolved).length, 1);
  const recovered = observePublication(
    rejected("staging", [], "verified"),
    source,
    failed.status,
    failed.issues,
    failed.unresolved,
  );
  assert.deepEqual(mergedIssues(recovered.unresolved), []);
  assert.ok(recovered.notices.includes("staging: publication recovered"));
});

test("fixing one note while another stays rejected removes only the fixed note", () => {
  const both = trackUnresolved(
    rejected("staging", [
      metadata("1", "Blog/a.md", invalid),
      metadata("2", "Blog/b.md", invalid),
    ]),
    {},
  );
  const one = trackUnresolved(
    rejected("staging", [metadata("2", "Blog/b.md", invalid)]),
    both,
  );
  assert.deepEqual(
    mergedIssues(one).map((issue) => issue.path),
    ["Blog/b.md"],
  );
});

test("a recovery in one target leaves the other target's issue untouched", () => {
  let state: IssueState = {};
  state = trackUnresolved(
    rejected("production", [metadata("1", "Blog/draft.md", invalid)]),
    state,
  );
  state = trackUnresolved(
    rejected("staging", [metadata("2", "Blog/draft.md", invalid)]),
    state,
  );
  state = trackUnresolved(rejected("staging", [], "verified"), state);
  assert.deepEqual(mergedIssues(state)[0].targets, ["production"]);
});

test("stale revision reports update unresolved issues only when they carry issues", () => {
  const stale = (issues: PublicationReport["issues"], status = "degraded") =>
    ({
      ...rejected("staging", issues, status as PublicationReport["status"]),
      source: fingerprint("9"),
    }) as PublicationReport;
  const seeded = trackUnresolved(
    rejected("staging", [metadata("1", "Blog/a.md", invalid)]),
    {},
  );
  const withIssues = observePublication(
    stale([metadata("2", "Blog/b.md", invalid)]),
    source,
    {},
    {},
    seeded,
  );
  assert.equal(withIssues.unresolved.staging?.[0].path, "Blog/b.md");
  const without = observePublication(
    stale([], "verified"),
    source,
    {},
    {},
    seeded,
  );
  assert.deepEqual(without.unresolved, seeded);
});

test("stored issues are restored when valid and dropped when malformed", () => {
  const good = {
    key: fingerprint("a"),
    category: "markdown_metadata",
    path: "Blog/a.md",
    reason: invalid,
    dismissed: false,
  };
  assert.deepEqual(
    readStoredIssues({
      staging: [good, { ...good, key: "private" }, { ...good, reason: "a\nb" }],
      production: "bad",
    }),
    { staging: [good] },
  );
  assert.deepEqual(readStoredIssues(undefined), {});
  assert.deepEqual(readStoredIssues(null), {});
});

test("report reads reject unbounded or control-character reasons and paths", () => {
  for (const issue of [
    { ...metadata("1", "Blog/a.md"), reason: "x".repeat(501) },
    { ...metadata("1", "Blog/a.md"), reason: "line\nbreak" },
    { ...metadata("1", "Blog/a.md"), reason: "" },
    { ...metadata("1", "Blog/a.md"), path: "bad\u0000path" },
  ])
    assert.throws(
      () => publicationNotices(rejected("staging", [issue]), {}),
      /protected issue/,
    );
  assert.doesNotThrow(() =>
    publicationNotices(
      rejected("staging", [metadata("1", "Blog/a.md", "x".repeat(500))]),
      {},
    ),
  );
});
