import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, symlink, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readProtectedReport,
  saveProtectedReport,
} from "./obsidian-reports.mjs";

const report = {
  version: 1,
  target: "staging",
  source: "a".repeat(64),
  code: "b".repeat(64),
  codeSha: "c".repeat(40),
  digest: "d".repeat(64),
  status: "degraded",
  reportedAt: "2026-10-04T23:00:00.000Z",
  files: [
    {
      path: "private.md",
      revision: "e".repeat(64),
      slug: "private",
      environment: "nonprod",
      sync: "add",
      draft: false,
      body: "raw post canary",
    },
  ],
  masks: [],
  issues: [
    {
      key: "f".repeat(64),
      category: "invalid_metadata",
      message: "raw post canary",
      credential: "secret canary",
    },
  ],
  body: "raw post canary",
  credential: "secret canary",
};

test("read-only diagnostics use the exact target key and omit raw content and credentials", async () => {
  for (const [mode, pr, target] of [
    ["staging", undefined, "staging"],
    ["production", undefined, "production"],
    ["preview", 403, "pr/403"],
  ]) {
    const calls = [];
    const store = {
      get: async (key, limit) => {
        calls.push({ key, limit });
        return Buffer.from(JSON.stringify({ ...report, target }));
      },
    };
    const parsed = await readProtectedReport(store, mode, pr);
    assert.deepEqual(calls, [
      { key: `reports/${target}.json`, limit: 2 * 1024 * 1024 },
    ]);
    assert.equal(parsed.target, target);
    assert.equal(parsed.reportedAt, report.reportedAt);
    assert.equal(parsed.files[0].path, "private.md");
    assert.equal(JSON.stringify(parsed).includes("raw post canary"), false);
    assert.equal(JSON.stringify(parsed).includes("secret canary"), false);
  }
});

test("stored reasons round trip while stray messages and reportless reasons are dropped", async () => {
  const read = async (issues) =>
    readProtectedReport(
      {
        get: async () => Buffer.from(JSON.stringify({ ...report, issues })),
      },
      "staging",
    );
  const key = "f".repeat(64),
    category = "markdown_metadata";
  const withReason = await read([
    {
      key,
      category,
      reason: "environment must be production or nonprod",
      message: "raw post canary",
    },
  ]);
  assert.equal(
    withReason.issues[0].reason,
    "environment must be production or nonprod",
  );
  assert.equal(JSON.stringify(withReason).includes("raw post canary"), false);
  const legacy = await read([{ key, category }]);
  assert.equal(legacy.issues.length, 1);
  assert.equal("reason" in legacy.issues[0], false);
  const stray = await read([{ key, category, message: "raw post canary" }]);
  assert.equal("reason" in stray.issues[0], false);
  assert.equal(JSON.stringify(stray).includes("raw post canary"), false);
});

test("oversize, empty, non-string and control-character reasons are rejected", async () => {
  for (const reason of [
    "a".repeat(501),
    "",
    "bad\u0000value",
    "line\nbreak",
    "bidi\u202eoverride",
    "separator\u2028here",
    42,
    null,
    {},
  ])
    await assert.rejects(
      readProtectedReport(
        {
          get: async () =>
            Buffer.from(
              JSON.stringify({
                ...report,
                issues: [
                  {
                    key: "f".repeat(64),
                    category: "markdown_metadata",
                    reason,
                  },
                ],
              }),
            ),
        },
        "staging",
      ),
      /Invalid protected report/,
    );
  const longest = await readProtectedReport(
    {
      get: async () =>
        Buffer.from(
          JSON.stringify({
            ...report,
            issues: [
              {
                key: "f".repeat(64),
                category: "markdown_metadata",
                reason: "a".repeat(500),
              },
            ],
          }),
        ),
    },
    "staging",
  );
  assert.equal(longest.issues[0].reason.length, 500);
});

test("unavailable, oversized, cross-target and malformed protected reports fail", async () => {
  for (const raw of [
    undefined,
    Buffer.alloc(2 * 1024 * 1024 + 1),
    Buffer.from("{"),
    Buffer.from(JSON.stringify({ ...report, target: "production" })),
    Buffer.from(
      JSON.stringify({
        ...report,
        issues: [{ key: "invalid", category: "invalid_metadata" }],
      }),
    ),
  ])
    await assert.rejects(
      readProtectedReport({ get: async () => raw }, "staging"),
    );
  await assert.rejects(
    readProtectedReport(
      {
        get: async () => {
          throw new Error("must not read");
        },
      },
      "local",
    ),
    /Hosted/,
  );
  await assert.rejects(
    readProtectedReport(
      {
        get: async () => {
          throw new Error("must not read");
        },
      },
      "preview",
      -1,
    ),
  );
});

test("private report files stay inside the ignored directory and reject linked outputs", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-reports-"));
  try {
    await saveProtectedReport(
      ".obsidian-publish/reports/staging.json",
      report,
      cwd,
    );
    const file = join(cwd, ".obsidian-publish/reports/staging.json");
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await chmod(file, 0o644);
    await saveProtectedReport(
      ".obsidian-publish/reports/staging.json",
      report,
      cwd,
    );
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(file, "utf8")).target, "staging");
    await assert.rejects(
      saveProtectedReport("public.json", report, cwd),
      /private/,
    );
    await symlink(cwd, join(cwd, ".obsidian-publish/linked"));
    await assert.rejects(
      saveProtectedReport(".obsidian-publish/linked/public.json", report, cwd),
      /Linked/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
