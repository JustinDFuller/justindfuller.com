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
import { isolatedRenderer } from "./render-obsidian-build.mjs";
import { publicationEnvironment } from "./obsidian-process.mjs";

const execute = promisify(execFile);

test(
  "hosted production renderer container exports a synthetic post without credentials",
  {
    skip:
      process.platform !== "linux"
        ? "renderer container regression requires Linux; local macOS runs are skipped"
        : process.env.CI !== "true"
          ? "renderer container regression runs in hosted CI"
          : false,
    timeout: 300_000,
  },
  async (t) => {
    const env = publicationEnvironment(process.env, "build");
    const workspace = await realpath(process.cwd());
    const { stdout: goRootOutput } = await execute("go", ["env", "GOROOT"], {
      env,
      timeout: 10_000,
    });
    const { stdout: moduleCacheOutput } = await execute(
      "go",
      ["env", "GOMODCACHE"],
      { env, timeout: 10_000 },
    );
    const goRoot = await realpath(goRootOutput.trim());
    const moduleCache = await realpath(moduleCacheOutput.trim());
    const privateRoot = `${workspace}/.obsidian-publish`;
    await mkdir(privateRoot, { recursive: true });
    const directory = await mkdtemp(`${privateRoot}/renderer-container-`);
    t.after(() => rm(directory, { recursive: true, force: true }));

    const sourcePath = relative(workspace, `${directory}/source.json`);
    const overlayPath = relative(workspace, `${directory}/prepared.json`);
    const body = Buffer.from(
      "---\nenvironment: production\nsection: programming\nslug: renderer-container-smoke\ntitle: Renderer Container Smoke\ndescription: Public renderer container fixture.\ndate: 2026-10-01\ndraft: false\nsync: add\ntags: [programming]\n---\nPublic renderer container canary.\n",
    );
    const sha256 = createHash("sha256").update(body).digest("hex");
    const snapshot = {
      version: 1,
      files: {
        "renderer-container-smoke.md": {
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
        bodies: { "renderer-container-smoke.md": body.toString("base64") },
        ready: {},
      }),
    );
    await execute(
      "go",
      [
        "run",
        "./cmd/prepare-obsidian",
        "--source",
        sourcePath,
        "--bootstrap",
        "--mode",
        "production",
        "--out",
        overlayPath,
      ],
      { cwd: workspace, env, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
    );

    await execute("docker", ["pull", "node:22-bookworm"], {
      env,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const dockerArgs = isolatedRenderer(workspace, goRoot, moduleCache);
    assert.ok(dockerArgs.includes("--network=none"));
    assert.ok(dockerArgs.includes("--read-only"));
    const legacyArgs = [...dockerArgs];
    const goRunMount = legacyArgs.findIndex((argument) =>
      argument.startsWith("/go-run:"),
    );
    if (goRunMount !== -1) legacyArgs.splice(goRunMount - 1, 2);
    const goTempEnv = legacyArgs.findIndex(
      (argument) => argument === "GOTMPDIR=/go-run",
    );
    if (goTempEnv !== -1) legacyArgs.splice(goTempEnv - 1, 2);
    const legacyOutput = `renderer-container-legacy-${process.pid}`;
    t.after(() =>
      rm(`${workspace}/${legacyOutput}`, { recursive: true, force: true }),
    );
    await assert.rejects(
      execute(
        "docker",
        [
          ...legacyArgs,
          "go",
          "run",
          "./cmd/export-static",
          "--out",
          legacyOutput,
          "--mode",
          "production",
        ],
        {
          cwd: workspace,
          env,
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      ),
      (error) => /permission denied/i.test(String(error.stderr ?? "")),
    );
    await execute(
      "docker",
      [
        ...dockerArgs,
        "npm",
        "run",
        "build:cloudflare",
        "--",
        "--mode",
        "production",
        "--overlay",
        overlayPath,
        "--publication-id",
        "a".repeat(64),
      ],
      {
        cwd: workspace,
        env,
        timeout: 180_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    const manifest = JSON.parse(
      await readFile(`${workspace}/.cloudflare/site-manifest.json`, "utf8"),
    );
    const html = await readFile(
      `${workspace}/dist/programming/renderer-container-smoke.html`,
      "utf8",
    );
    assert.ok(manifest.pages.includes("/programming/renderer-container-smoke"));
    assert.ok(html.includes("Renderer Container Smoke"));
    assert.ok(html.includes("Public renderer container canary."));
  },
);
