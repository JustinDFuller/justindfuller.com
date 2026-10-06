import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { relative } from "node:path";
import { canonicalSnapshot } from "../tools/obsidian-image-publisher/src/content.ts";
import { isolatedPreparationCommand } from "./prepare-obsidian-target.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";

const execute = promisify(execFile);

test(
  "hosted offline preparation container prepares a synthetic post without credentials",
  {
    skip: process.platform !== "linux" || process.env.CI !== "true",
    timeout: 300_000,
  },
  async (t) => {
    const env = publicationEnvironment(process.env, "build");
    const workspace = await realpath(process.cwd());
    const controlWorkspace = await realpath(`${workspace}/control`);
    const { stdout } = await execute("go", ["env", "GOMODCACHE"], {
      env,
      timeout: 10_000,
    });
    const moduleCache = await realpath(stdout.trim());
    await mkdir(`${workspace}/.obsidian-publish`, { recursive: true });
    const directory = await mkdtemp(
      `${workspace}/.obsidian-publish/container-smoke-`,
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const sourcePath = relative(workspace, `${directory}/source.json`);
    const outputPath = relative(workspace, `${directory}/prepared.json`);
    const body = Buffer.from(
      "---\nenvironment: production\nsection: programming\nslug: container-smoke\ntitle: Container Smoke\ndate: 2026-10-01\ndraft: false\nsync: add\ntags: [programming]\n---\nPublic synthetic container test.\n",
    );
    const sha256 = createHash("sha256").update(body).digest("hex");
    const snapshot = {
      version: 1,
      files: {
        "container-smoke.md": {
          key: `markdown/v1/${sha256}.md`,
          sha256,
          size: body.length,
        },
      },
      images: {},
    };
    const revision = createHash("sha256")
      .update(canonicalSnapshot(snapshot))
      .digest("hex");
    await writeFile(
      `${workspace}/${sourcePath}`,
      JSON.stringify({
        snapshot,
        revision,
        bodies: { "container-smoke.md": body.toString("base64") },
        ready: {},
      }),
    );
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
      args: [
        "run",
        "./cmd/prepare-obsidian",
        "--source",
        sourcePath,
        "--bootstrap",
        "--mode",
        "production",
        "--out",
        outputPath,
      ],
    });
    assert.ok(args.includes("--network=none"));
    assert.ok(args.includes("--read-only"));
    await execute("docker", args, {
      cwd: workspace,
      env,
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const prepared = JSON.parse(
      await readFile(`${workspace}/${outputPath}`, "utf8"),
    );
    assert.equal(prepared.mode, "production");
    assert.equal(prepared.revision, revision);
    assert.ok(
      prepared.entries.some((entry) => entry.Slug === "container-smoke"),
    );
    assert.equal(prepared.issues?.length ?? 0, 0);
  },
);
