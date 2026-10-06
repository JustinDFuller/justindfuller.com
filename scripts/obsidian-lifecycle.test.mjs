import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archiveLifecycleRule,
  planArchiveLifecycle,
  configureArchiveLifecycle,
} from "./obsidian-lifecycle.mjs";

const multipart = {
  id: "Default Multipart Abort Rule",
  enabled: true,
  abortMultipartUploadsTransition: {
    condition: { type: "Age", maxAge: 7 * 24 * 60 * 60 },
  },
};

test("archive expiration preserves the existing multipart rule and retains state, source, reports, and rollback", () => {
  const current = { rules: [structuredClone(multipart)] },
    plan = planArchiveLifecycle(current);
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.rules[0], multipart);
  assert.deepEqual(current.rules, [multipart]);
  const rule = plan.rules[1];
  assert.equal(rule.conditions.prefix, "artifacts/");
  assert.equal(rule.deleteObjectsTransition.condition.maxAge, 1209600);
  for (const key of [
    "accepted/staging/current.json",
    "journals/production/pending.json",
    "reports/pr/403.json",
    "receipts/code/commit/policy.json",
    "rollback/artifacts/staging/prior.tar",
    "rollback/accepted/production/state.json",
    "snapshots/revision.json",
    "markdown/v1/hash.md",
    "artifactss/other.tar",
  ])
    assert.equal(key.startsWith(rule.conditions.prefix), false);
  for (const key of [
    "artifacts/staging/123/hash.tar",
    "artifacts/pr/403/123/hash.tar",
  ])
    assert.equal(key.startsWith(rule.conditions.prefix), true);
  assert.equal(planArchiveLifecycle({ rules: plan.rules }).changed, false);
});

test("overlapping permanent-state deletion, shorter archive expiration, and a modified managed rule require review", () => {
  for (const prefix of [
    "",
    "accepted/",
    "rollback/",
    "reports/",
    "artifacts",
    undefined,
  ])
    assert.throws(
      () =>
        planArchiveLifecycle({
          rules: [
            {
              id: "unsafe-delete",
              enabled: true,
              conditions: { prefix },
              deleteObjectsTransition: {
                condition: { type: "Age", maxAge: 1209600 },
              },
            },
          ],
        }),
      /retained/,
    );
  for (const condition of [
    { type: "Age", maxAge: 60 },
    { type: "Date", date: "2026-10-06T00:00:00Z" },
    { type: "Age", maxAge: "1209600" },
  ])
    assert.throws(
      () =>
        planArchiveLifecycle({
          rules: [
            {
              id: "unsafe-delete",
              enabled: true,
              conditions: { prefix: "artifacts/pr/" },
              deleteObjectsTransition: { condition },
            },
          ],
        }),
      /retained/,
    );
  assert.throws(
    () =>
      planArchiveLifecycle({
        rules: [{ ...structuredClone(archiveLifecycleRule), enabled: false }],
      }),
    /operator review/,
  );
  assert.throws(
    () => planArchiveLifecycle({ rules: [multipart, multipart] }),
    /Invalid/,
  );
  assert.throws(() => planArchiveLifecycle({}), /unavailable/);
});

test("configuration is read-only by default, applies the reviewed rule once, and requires exact readback", async () => {
  let rules = [structuredClone(multipart)],
    writes = 0;
  const client = {
    read: async () => ({ rules }),
    write: async (value) => {
      writes++;
      rules = value.rules;
    },
  };
  const dry = await configureArchiveLifecycle(client);
  assert.equal(dry.status, "configuration-required");
  assert.equal(writes, 0);
  const result = await configureArchiveLifecycle(client, { apply: true });
  assert.equal(result.status, "verified");
  assert.equal(result.changed, true);
  assert.equal(writes, 1);
  rules = rules.map((rule) =>
    Object.fromEntries(Object.entries(rule).reverse()),
  );
  assert.equal(
    (await configureArchiveLifecycle(client, { apply: true })).changed,
    false,
  );
  assert.equal(writes, 1);
  const unchanged = [structuredClone(multipart)];
  await assert.rejects(
    configureArchiveLifecycle(
      {
        read: async () => ({ rules: unchanged }),
        write: async () => {},
      },
      { apply: true },
    ),
    /readback/,
  );
  assert.equal(unchanged.length, 1);
  let calls = 0;
  await assert.rejects(
    configureArchiveLifecycle(
      {
        read: async () => ({
          rules: calls++
            ? [structuredClone(archiveLifecycleRule)]
            : [multipart],
        }),
        write: async () => {},
      },
      { apply: true },
    ),
    /readback/,
  );
});
