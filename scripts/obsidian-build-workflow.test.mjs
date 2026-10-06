import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { preparationCode } from "./prepare-obsidian-target.mjs";
import { downloadPrivateBuildInput } from "./download-obsidian-build.mjs";
import { isolatedRenderer } from "./render-obsidian-build.mjs";
import { readPrivateBuildFile } from "./upload-obsidian-build.mjs";

const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");

function validBundle() {
  const mode = "staging",
    codeSha = "a".repeat(40),
    source = "b".repeat(64),
    digest = "c".repeat(64),
    state = { version: 1, mode, revision: source },
    prepared = {
      version: 1,
      mode,
      revision: source,
      digest,
      state,
      entries: [],
      images: {},
    };
  return {
    version: 1,
    target: mode,
    run: "123-1",
    codeSha,
    candidate: {
      source,
      code: preparationCode(codeSha, mode),
      codeSha,
      digest,
      state,
      verification: { prepared },
    },
    diagnostics: {
      version: 1,
      mode,
      source,
      digest,
      files: [],
      issues: [],
    },
  };
}

test("private build download saves the correlated candidate under ignored storage", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-build-workflow-")),
    bundle = validBundle(),
    bytes = Buffer.from(JSON.stringify(bundle)),
    digest = checksum(bytes);
  try {
    const result = await downloadPrivateBuildInput({
      store: { get: async () => bytes },
      mode: "staging",
      run: bundle.run,
      codeSha: bundle.codeSha,
      preparation: digest,
      cwd,
    });
    assert.equal(result.target, "staging");
    const saved = JSON.parse(
      await readFile(
        join(cwd, ".obsidian-publish/hosted/staging/build-input.json"),
        "utf8",
      ),
    );
    assert.equal(saved.preparation, digest);
    assert.equal(saved.candidate.digest, bundle.candidate.digest);
    assert.equal(saved.publication.length, 64);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("renderer container has no network and mounts trusted inputs read only", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-build-container-"));
  try {
    await mkdir(join(cwd, "control"));
    const args = isolatedRenderer(cwd, "/opt/go", "/home/runner/go/pkg/mod");
    assert.ok(args.includes("--network=none"));
    assert.ok(args.includes("--pull=never"));
    assert.ok(args.includes("GOTMPDIR=/go-run"));
    assert.ok(
      args.includes(
        `/go-run:rw,exec,nosuid,nodev,uid=${process.getuid()},gid=${process.getgid()},size=1g`,
      ),
    );
    assert.ok(args.includes("/opt/go:/opt/go:ro"));
    assert.ok(args.includes("/home/runner/go/pkg/mod:/go/pkg/mod:ro"));
    assert.ok(args.includes(join(cwd, "control") + ":/workspace/control:ro"));
    assert.equal(
      args.some((value) => value.includes("docker.sock")),
      false,
    );
    assert.throws(() => isolatedRenderer(cwd, "", "/cache"), /toolchain/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("private upload reader rejects symlinked paths and bounds file size", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-upload-workflow-")),
    privateDir = join(cwd, ".obsidian-publish/hosted/staging");
  try {
    await mkdir(privateDir, { recursive: true });
    await writeFile(join(privateDir, "safe.json"), "{}", { mode: 0o600 });
    assert.equal(
      (
        await readPrivateBuildFile(
          ".obsidian-publish/hosted/staging/safe.json",
          cwd,
        )
      ).toString(),
      "{}",
    );
    await writeFile(join(cwd, "outside.json"), "secret");
    await symlink(join(cwd, "outside.json"), join(privateDir, "linked.json"));
    await assert.rejects(
      readPrivateBuildFile(".obsidian-publish/hosted/staging/linked.json", cwd),
      /private build input/,
    );
    await assert.rejects(
      readPrivateBuildFile(
        ".obsidian-publish/hosted/staging/safe.json",
        cwd,
        1,
      ),
      /Bounded/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
