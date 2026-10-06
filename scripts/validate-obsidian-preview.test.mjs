import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validatePreviewCode } from "./validate-obsidian-preview.mjs";

test("preview checks run offline with trusted control and Go inputs read-only", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-preview-checks-"));
  try {
    await mkdir(join(cwd, "control"));
    const calls = [];
    const result = await validatePreviewCode({
      cwd,
      goRoot: "/trusted/go",
      goModCache: "/trusted/modules",
      execute: async (command, args, options) => {
        calls.push({ command, args, options });
        return { stdout: "", stderr: "" };
      },
    });
    assert.equal(result.validated, true);
    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.command, "docker");
      assert.ok(call.args.includes("--network=none"));
      assert.ok(call.args.includes("--pull=never"));
      assert.ok(call.args.includes(`${cwd}/control:/workspace/control:ro`));
      assert.ok(call.args.includes("/trusted/go:/opt/go:ro"));
      assert.ok(call.args.includes("/trusted/modules:/go/pkg/mod:ro"));
      assert.equal(call.options.purpose, "build");
      assert.equal(call.options.env, undefined);
    }
    assert.ok(calls[1].args.includes("test"));
    assert.ok(calls[2].args.includes("node"));
    assert.ok(calls[3].args.includes("--noEmit"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("failed preview checks stop before later checks", async () => {
  let calls = 0;
  await assert.rejects(
    validatePreviewCode({
      goRoot: "/trusted/go",
      goModCache: "/trusted/modules",
      execute: async () => {
        calls++;
        throw new Error("fixture failure");
      },
    }),
    /fixture failure/,
  );
  assert.equal(calls, 1);
});

test("unchanged previews skip frontend checks and changed previews validate before private input", async () => {
  const workflow = await readFile(
      ".github/workflows/obsidian-target.yml",
      "utf8",
    ),
    validate = workflow.slice(
      workflow.indexOf("  validate:"),
      workflow.indexOf("  prepare:"),
    ),
    build = workflow.slice(
      workflow.indexOf("  build:"),
      workflow.indexOf("  deploy:"),
    );
  assert.doesNotMatch(
    validate,
    /Install preview dependencies|Validate current preview code/,
  );
  assert.match(
    build,
    /if: needs\.prepare\.outputs\.decision == 'build-required'/,
  );
  assert.ok(
    build.indexOf("validate-obsidian-preview.mjs") <
      build.indexOf("download-obsidian-build.mjs"),
  );
  assert.ok(
    build.indexOf("Remove any control entry") <
      build.indexOf("Restore trusted control code"),
  );
});
