import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observePublication,
  queuedPublication,
  publicationNotices,
  readPublicationReport,
  publicationStatusSummary,
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

test("pending protected reads yield control while provider credentials or responses are unavailable", async () => {
  let finish: (value: Uint8Array) => void = () => {
    throw new Error("Read not started");
  };
  const pending = readPublicationReport(
    {
      get: async () =>
        new Promise<Uint8Array>((resolve) => {
          finish = resolve;
        }),
    },
    "staging",
  );
  let finished = false;
  void pending.then(() => {
    finished = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  finish(Buffer.from(JSON.stringify(report("staging", "verified"))));
  assert.equal((await pending).target, "staging");
});
