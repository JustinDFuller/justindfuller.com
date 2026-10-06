import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalSnapshot } from "../tools/obsidian-image-publisher/src/content.ts";
import {
  archiveChecksum,
  createPublicationArchive,
  inspectPublicationArchive,
} from "./obsidian-archive.mjs";
import { archiveKey, archiveTransfer } from "./obsidian-private-storage.mjs";
import {
  publicPublicationReceipt,
  protectedPublicationReport,
} from "./record-obsidian-publication.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function runGo(args, cwd) {
  const result = spawnSync("go", ["run", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `go command failed: ${args[0]}`);
}

async function archiveFixture(directory, exported, manifest) {
  await mkdir(join(directory, ".cloudflare", "output"), { recursive: true });
  await cp(exported, join(directory, "dist"), { recursive: true });
  await cp(manifest, join(directory, ".cloudflare", "site-manifest.json"));
  await writeFile(
    join(directory, ".cloudflare", "output", "config.json"),
    "{}",
  );
}

function archiveContent(bytes) {
  const entries = inspectPublicationArchive(bytes, archiveChecksum(bytes));
  const searchable = Buffer.concat(
    entries.flatMap((entry) => [Buffer.from(entry.name), entry.bytes]),
  );
  return { entries, searchable };
}

test("real preparation and static export keep nonprod and draft canaries out of production", async (t) => {
  const repository = process.cwd(),
    inputDirectory = await mkdtemp(join(tmpdir(), "obsidian-privacy-input-")),
    privateDirectory = await mkdtemp(
      join(tmpdir(), "obsidian-privacy-private-"),
    ),
    publicPackage = await mkdtemp(join(tmpdir(), "obsidian-privacy-public-")),
    previewPackage = await mkdtemp(join(tmpdir(), "obsidian-privacy-preview-"));
  t.after(async () => {
    await Promise.all(
      [inputDirectory, privateDirectory, publicPackage, previewPackage].map(
        (directory) => rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  const sourceFiles = {
    "private-filename-nonprod-canary.md": Buffer.from(
      "---\nenvironment: nonprod\nsection: programming\nslug: private-nonprod-canary\ntitle: nonprod-title-canary\ndate: 2026-10-01\ndraft: false\nsync: add\ntags: [programming]\n---\nnonprod-body-canary\n",
    ),
    "private-filename-draft-canary.md": Buffer.from(
      "---\nenvironment: production\nsection: programming\nslug: private-draft-canary\ntitle: draft-title-canary\ndate: 2026-10-02\ndraft: true\nsync: add\ntags: [programming]\n---\ndraft-body-canary\n",
    ),
  };
  const snapshot = { version: 1, files: {}, images: {} },
    bodies = {};
  for (const [filename, bytes] of Object.entries(sourceFiles)) {
    const sha256 = hash(bytes);
    snapshot.files[filename] = {
      key: `markdown/v1/${sha256}.md`,
      sha256,
      size: bytes.length,
    };
    bodies[filename] = bytes.toString("base64");
  }
  const revision = hash(canonicalSnapshot(snapshot)),
    sourcePath = join(inputDirectory, "source.json");
  await writeFile(
    sourcePath,
    JSON.stringify({ snapshot, revision, bodies, ready: {} }),
  );

  const prepared = {};
  for (const mode of ["production", "preview"]) {
    const output = join(privateDirectory, `${mode}.json`);
    runGo(
      [
        "./cmd/prepare-obsidian",
        "--source",
        sourcePath,
        "--bootstrap",
        "--mode",
        mode,
        "--out",
        output,
      ],
      repository,
    );
    prepared[mode] = JSON.parse(await readFile(output, "utf8"));
  }
  assert.ok(
    prepared.production.entries.every(
      (entry) => !entry.Slug?.includes("canary"),
    ),
  );
  assert.ok(
    prepared.preview.entries.some(
      (entry) => entry.Slug === "private-nonprod-canary",
    ),
  );
  assert.ok(prepared.preview.masks.includes("private-draft-canary"));
  assert.ok(
    prepared.preview.entries.every(
      (entry) => entry.Slug !== "private-draft-canary",
    ),
  );

  const exports = {};
  for (const mode of ["production", "preview"]) {
    const name = `.obsidian-privacy-export-${process.pid}-${mode}`,
      output = resolve(repository, name),
      manifest = join(privateDirectory, `${mode}-manifest.json`);
    t.after(() => rm(output, { recursive: true, force: true }));
    runGo(
      [
        "./cmd/export-static",
        "--out",
        output,
        "--manifest",
        manifest,
        "--mode",
        mode,
        "--overlay",
        join(privateDirectory, `${mode}.json`),
      ],
      repository,
    );
    exports[mode] = { output, manifest };
  }

  const nonprodPreview = await readFile(
      join(
        exports.preview.output,
        "programming",
        "private-nonprod-canary.html",
      ),
      "utf8",
    ),
    privateCanaries = [
      "nonprod-title-canary",
      "nonprod-body-canary",
      "private-nonprod-canary",
      "draft-title-canary",
      "draft-body-canary",
      "private-draft-canary",
      "private-filename-nonprod-canary.md",
      "private-filename-draft-canary.md",
      "source-snapshot-canary",
      "overlay-state-canary",
      "private-report-canary",
      "credential-secret-canary",
    ];
  assert.ok(nonprodPreview.includes("nonprod-title-canary"));
  assert.ok(nonprodPreview.includes("nonprod-body-canary"));
  await archiveFixture(
    publicPackage,
    exports.production.output,
    exports.production.manifest,
  );
  await archiveFixture(
    previewPackage,
    exports.preview.output,
    exports.preview.manifest,
  );
  const privateState = join(previewPackage, ".obsidian-publish");
  await mkdir(privateState, { recursive: true });
  await writeFile(
    join(privateState, "source-snapshot.json"),
    JSON.stringify({ snapshot, canary: "source-snapshot-canary" }),
  );
  await writeFile(
    join(privateState, "overlay.json"),
    JSON.stringify({
      prepared: prepared.preview,
      canary: "overlay-state-canary",
    }),
  );
  await writeFile(
    join(privateState, "state.json"),
    JSON.stringify({
      files: sourceFiles,
      credential: "credential-secret-canary",
      canary: "private-report-canary",
    }),
  );
  const candidate = {
    source: revision,
    code: "b".repeat(64),
    codeSha: "c".repeat(40),
    digest: prepared.preview.digest,
    state: { mode: "preview" },
  };
  const diagnostics = {
    version: 1,
    source: candidate.source,
    digest: candidate.digest,
    mode: "preview",
    files: Object.keys(sourceFiles).map((path, index) => ({
      path,
      revision: String(index + 1).repeat(64),
      slug: index ? "private-draft-canary" : "private-nonprod-canary",
      environment: index ? "production" : "nonprod",
      sync: "add",
      draft: index === 1,
    })),
    masks: ["private-draft-canary"],
    issues: [],
  };
  const report = protectedPublicationReport(
    candidate,
    "pr/403",
    "verified",
    diagnostics,
  );
  await saveProtectedReport(
    ".obsidian-publish/report.json",
    report,
    previewPackage,
  );
  await cp(privateState, join(publicPackage, ".obsidian-publish"), {
    recursive: true,
  });

  const publicReceipt = publicPublicationReceipt(
      candidate,
      {
        accepted: {
          receipt: {
            artifact: "f".repeat(64),
            deployment: "12345678-1234-1234-1234-123456789abc",
          },
        },
      },
      "pr/403",
      12,
      {},
      "123-1",
      "2026-10-06T12:00:00.000Z",
    ),
    serializedReceipt = JSON.stringify(publicReceipt);
  for (const canary of privateCanaries)
    assert.equal(serializedReceipt.includes(canary), false);
  assert.equal(serializedReceipt.includes("credential-secret-canary"), false);

  const productionArchive = createPublicationArchive(publicPackage),
    previewArchive = createPublicationArchive(previewPackage),
    productionContents = archiveContent(productionArchive).searchable,
    previewContents = archiveContent(previewArchive).searchable;
  for (const canary of privateCanaries)
    assert.equal(productionContents.includes(Buffer.from(canary)), false);
  for (const canary of [
    "draft-title-canary",
    "draft-body-canary",
    "private-draft-canary",
    "private-filename-draft-canary.md",
    "credential-secret-canary",
    "source-snapshot.json",
    "overlay.json",
    "state.json",
    "report.json",
    "source-snapshot-canary",
    "overlay-state-canary",
    "private-report-canary",
  ]) {
    assert.equal(previewContents.includes(Buffer.from(canary)), false);
    assert.equal(productionContents.includes(Buffer.from(canary)), false);
    assert.equal(serializedReceipt.includes(canary), false);
  }
  assert.ok(previewContents.includes(Buffer.from("nonprod-title-canary")));
  assert.ok(previewContents.includes(Buffer.from("nonprod-body-canary")));
  assert.ok(previewContents.includes(Buffer.from("private-nonprod-canary")));

  const checksum = archiveChecksum(previewArchive),
    key = archiveKey("preview", 403, "123-1", checksum),
    objects = new Map(),
    store = {
      get: async (objectKey) => objects.get(objectKey),
      put: async (objectKey, bytes, immutable) => {
        assert.equal(immutable, true);
        objects.set(objectKey, Buffer.from(bytes));
      },
    },
    retained = await archiveTransfer(
      store,
      "upload",
      key,
      previewArchive,
      checksum,
    );
  assert.deepEqual(retained, previewArchive);
  assert.ok(
    archiveContent(retained).searchable.includes(
      Buffer.from("nonprod-body-canary"),
    ),
  );
  const savedReport = JSON.parse(
    await readFile(join(privateState, "report.json"), "utf8"),
  );
  assert.ok(
    savedReport.files.some(
      (file) => file.path === "private-filename-draft-canary.md",
    ),
  );
});
