import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicIssueOutput } from "./report-obsidian-issues.mjs";

const script = fileURLToPath(
    new URL("./report-obsidian-issues.mjs", import.meta.url),
  ),
  checksum = "a".repeat(64),
  result = (summary, extra = {}) => ({
    version: 1,
    status: "prepared",
    target: "staging",
    decision: "build-required",
    handoff: { key: "candidates/private-key", checksum },
    issueSummary: summary,
    ...extra,
  }),
  privateFields = {
    path: "private-path-canary.md",
    slug: "private-slug-canary",
    title: "private-title-canary",
    reason: "private-reason-canary",
    message: "private-reason-canary",
    issues: [
      { path: "private-path-canary.md", message: "private-reason-canary" },
    ],
  };

test("a rejected file produces a sanitized warning, summary line and outputs", () => {
  const output = publicIssueOutput(
    result(
      { files: 1, blocking: 1, categories: { markdown_metadata: 1 } },
      privateFields,
    ),
  );
  assert.equal(
    output.annotation,
    "::warning title=Obsidian publication issues::staging: 1 file with issues (markdown_metadata: 1)",
  );
  assert.equal(
    output.summaryLine,
    "- staging: 1 file with issues (markdown_metadata: 1)\n",
  );
  assert.deepEqual(output.outputs, {
    decision: "build-required",
    handoff: checksum,
    blocking: "1",
    categories: '{"markdown_metadata":1}',
  });
  const serialized = JSON.stringify(output);
  for (const secret of [
    "private-path",
    "private-slug",
    "private-title",
    "private-reason",
    "candidates/private-key",
  ])
    assert.equal(serialized.includes(secret), false);
});

test("several categories and files are counted per category", () => {
  const output = publicIssueOutput(
    result(
      {
        files: 3,
        blocking: 2,
        categories: {
          image_not_ready: 1,
          last_known_good: 2,
          markdown_body: 1,
        },
      },
      { target: "pr/403", decision: "skip-build", handoff: undefined },
    ),
  );
  assert.equal(
    output.summaryLine,
    "- pr/403: 3 files with issues (image_not_ready: 1, last_known_good: 2, markdown_body: 1)\n",
  );
  assert.equal(output.outputs.handoff, "");
  assert.equal(output.outputs.blocking, "2");
});

test("image-not-ready alone warns without any blocking count", () => {
  const output = publicIssueOutput(
    result({ files: 2, blocking: 0, categories: { image_not_ready: 2 } }),
  );
  assert.equal(output.outputs.blocking, "0");
  assert.match(output.annotation, /^::warning /);
});

test("a clean fixture emits no warning and no summary line", () => {
  const output = publicIssueOutput(
    result({ files: 0, blocking: 0, categories: {} }, privateFields),
  );
  assert.equal(output.annotation, undefined);
  assert.equal(output.summaryLine, undefined);
  assert.equal(output.outputs.blocking, "0");
  assert.equal(output.outputs.categories, "{}");
});

test("malformed, inconsistent or unsafe summaries are rejected", () => {
  const valid = { files: 1, blocking: 1, categories: { markdown_metadata: 1 } };
  for (const bad of [
    result(undefined),
    result({ ...valid, files: -1 }),
    result({ ...valid, files: 1.5 }),
    result({ ...valid, blocking: 2 }),
    result({ ...valid, blocking: 0 }),
    result({ files: 1, blocking: 1, categories: { image_not_ready: 1 } }),
    result({ ...valid, categories: { "Private Title": 1 } }),
    result({ ...valid, categories: { "a\n::error::x": 1 } }),
    result({ ...valid, categories: { markdown_metadata: 0 } }),
    result(valid, { target: "staging\n::error::x" }),
    result(valid, { target: "../production" }),
    result(valid, { decision: "unknown" }),
    result(valid, { handoff: { checksum: "a\nfoo=bar" } }),
    result(valid, { handoff: { checksum: "short" } }),
  ])
    assert.throws(
      () => publicIssueOutput(bad),
      /Invalid preparation issue summary/,
    );
});

test("the command appends outputs and the summary, prints the annotation, and leaks nothing private", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "obsidian-issues-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "result.json"),
    outputs = join(directory, "output"),
    summary = join(directory, "summary");
  await writeFile(
    input,
    JSON.stringify(
      result(
        { files: 1, blocking: 1, categories: { markdown_metadata: 1 } },
        privateFields,
      ),
    ),
  );
  await writeFile(outputs, "");
  await writeFile(summary, "");
  const run = spawnSync(process.execPath, [script, "--result", input], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputs,
      GITHUB_STEP_SUMMARY: summary,
    },
  });
  assert.equal(run.status, 0);
  assert.equal(
    run.stdout,
    "::warning title=Obsidian publication issues::staging: 1 file with issues (markdown_metadata: 1)\n",
  );
  assert.equal(run.stderr, "");
  assert.equal(
    await readFile(outputs, "utf8"),
    `decision=build-required\nhandoff=${checksum}\nblocking=1\ncategories={"markdown_metadata":1}\n`,
  );
  assert.equal(
    await readFile(summary, "utf8"),
    "- staging: 1 file with issues (markdown_metadata: 1)\n",
  );
  for (const text of [run.stdout, run.stderr, await readFile(summary, "utf8")])
    assert.equal(/private-/.test(text), false);

  await writeFile(
    input,
    JSON.stringify(result({ files: 0, blocking: 0, categories: {} })),
  );
  await writeFile(outputs, "");
  await writeFile(summary, "");
  const clean = spawnSync(process.execPath, [script, "--result", input], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputs,
      GITHUB_STEP_SUMMARY: summary,
    },
  });
  assert.equal(clean.status, 0);
  assert.equal(clean.stdout, "");
  assert.equal(await readFile(summary, "utf8"), "");
  assert.match(await readFile(outputs, "utf8"), /^decision=build-required\n/);
});

test("the command fails closed on an unreadable or invalid result without printing details", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "obsidian-issues-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "result.json"),
    outputs = join(directory, "output");
  await writeFile(outputs, "");
  await writeFile(input, JSON.stringify({ target: "private-title-canary" }));
  for (const args of [
    ["--result", input],
    ["--result", join(directory, "missing.json")],
    [],
  ]) {
    const run = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: outputs },
    });
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
    assert.equal(run.stderr, "Preparation issue summary unavailable\n");
  }
  assert.equal(await readFile(outputs, "utf8"), "");
});
