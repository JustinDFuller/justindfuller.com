import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { isolatedPreparationCommand } from "./prepare-obsidian-target.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";

const execute = promisify(execFile);

test(
  "hosted offline preparation container compiles the real preparer without credentials",
  {
    skip: process.platform !== "linux" || process.env.CI !== "true",
    timeout: 180_000,
  },
  async () => {
    const env = publicationEnvironment(process.env, "build");
    const workspace = await realpath(process.cwd());
    const controlWorkspace = await realpath(`${workspace}/control`);
    const { stdout } = await execute("go", ["env", "GOMODCACHE"], {
      env,
      timeout: 10_000,
    });
    const moduleCache = await realpath(stdout.trim());
    await execute("docker", ["pull", "golang:1.26.0-bookworm"], {
      env,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const args = isolatedPreparationCommand({
      workspace,
      controlWorkspace,
      moduleCache,
      uid: process.getuid(),
      gid: process.getgid(),
      args: ["build", "-o", "/tmp/prepare-obsidian", "./cmd/prepare-obsidian"],
    });
    assert.ok(args.includes("--network=none"));
    assert.ok(args.includes("--read-only"));
    const result = await execute("docker", args, {
      cwd: workspace,
      env,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(result.stderr, "");
  },
);
