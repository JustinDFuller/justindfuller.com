import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { isolatedRenderer } from "./render-obsidian-build.mjs";
import {
  publicationEnvironment,
  PublicationSubprocessError,
} from "./obsidian-process.mjs";
import {
  previewValidationFailure,
  validatePreviewCode,
} from "./validate-obsidian-preview.mjs";

const executeFile = promisify(execFile);
const rendererImage = "node:22-bookworm";

test(
  "hosted preview source checks run inside the isolated renderer container",
  {
    skip:
      process.platform !== "linux"
        ? "preview container regression requires Linux; local macOS runs are skipped"
        : process.env.CI !== "true"
          ? "preview container regression runs in hosted CI"
          : false,
    timeout: 780_000,
  },
  async () => {
    const env = publicationEnvironment(process.env, "build");
    const cwd = await realpath(process.cwd());
    const { stdout: goRootOutput } = await executeFile(
      "go",
      ["env", "GOROOT"],
      {
        cwd,
        env,
        timeout: 10_000,
      },
    );
    const { stdout: moduleCacheOutput } = await executeFile(
      "go",
      ["env", "GOMODCACHE"],
      { cwd, env, timeout: 10_000 },
    );
    const goRoot = await realpath(goRootOutput.trim());
    const goModCache = await realpath(moduleCacheOutput.trim());
    await executeFile("docker", ["pull", rendererImage], {
      cwd,
      env,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const runner = isolatedRenderer(cwd, goRoot, goModCache);
    assert.ok(runner.includes("--network=none"));
    assert.ok(runner.includes("--read-only"));
    assert.ok(runner.includes("--cap-drop=ALL"));
    assert.ok(runner.includes("--pids-limit=256"));
    assert.ok(runner.includes(rendererImage));
    const userIndex = runner.indexOf("--user");
    assert.notEqual(userIndex, -1);
    assert.notEqual(runner[userIndex + 1], "0:0");

    const boundedExecute = async (command, args, options = {}) => {
      try {
        return await executeFile(command, args, {
          cwd: options.cwd,
          env: publicationEnvironment(process.env, "build"),
          timeout: 180_000,
          maxBuffer: 32 * 1024 * 1024,
        });
      } catch (error) {
        throw new PublicationSubprocessError(command, error);
      }
    };
    let result;
    try {
      result = await validatePreviewCode({
        cwd,
        goRoot,
        goModCache,
        execute: boundedExecute,
      });
    } catch (error) {
      assert.fail(
        `Preview source validation failed: ${JSON.stringify(previewValidationFailure(error))}`,
      );
    }
    assert.deepEqual(result, { version: 1, checks: 4, validated: true });
  },
);
