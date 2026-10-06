import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";
import {
  archiveChecksum,
  createPublicationArchive,
  inspectPublicationArchive,
  restorePublicationArchive,
} from "./obsidian-archive.mjs";
import {
  compilePrivateWorker,
  repackagePrivateWorkerArchive,
  validatePrivateWorkerArchive,
  validateRetainedPrivateWorkerArchive,
} from "./obsidian-worker.mjs";

const execFile = promisify(execFileCallback);
const account = "9dce34804a27754a4ea66a5789827dfa";
const originalWorkingDirectory = process.cwd();
const sha = "a".repeat(64);
const md5 = "b".repeat(32);
const imageKey = `v1/${sha}.png`;
const images = {
  [imageKey]: {
    sha256: sha,
    md5,
    size: 1024,
    contentType: "image/png",
    key: imageKey,
  },
};

function fixtureArchive(
  directory,
  { mode = "preview", module, extraWorker = false } = {},
) {
  const worker = ".cloudflare/output/v0/workers/default/",
    marker = JSON.stringify({ version: 1, publication: "c".repeat(64) });
  mkdirSync(join(directory, "dist"), { recursive: true });
  mkdirSync(join(directory, `${worker}assets`), { recursive: true });
  mkdirSync(join(directory, `${worker}bundle`), { recursive: true });
  writeFileSync(join(directory, "dist/__publication.json"), marker);
  writeFileSync(join(directory, `${worker}assets/__publication.json`), marker);
  writeFileSync(join(directory, "dist/index.html"), "Rendered site");
  writeFileSync(join(directory, `${worker}assets/index.html`), "Rendered site");
  writeFileSync(
    join(directory, ".cloudflare/output/v0/config.json"),
    JSON.stringify({
      accountId: account,
      buildContext: { mode, isPreview: mode === "preview" },
    }),
  );
  writeFileSync(
    join(directory, `${worker}worker.config.json`),
    JSON.stringify({
      name:
        mode === "staging"
          ? "justindfuller-site-staging"
          : "justindfuller-site",
      compatibilityDate: "2026-10-03",
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "404-page",
        runWorkerFirst: true,
      },
      domains: mode === "staging" ? ["staging.justindfuller.com"] : [],
      triggers: [],
      workersDev: mode === "preview",
      previewUrls: mode !== "staging",
      env: {
        ASSETS: { type: "assets" },
        OBSIDIAN_SOURCE: { type: "r2", name: "justindfuller-obsidian-source" },
      },
      manifest: {
        type: "complete",
        mainModule: "private.js",
        modules: { "private.js": { type: "esm" } },
      },
    }),
  );
  writeFileSync(
    join(directory, `${worker}bundle/private.js`),
    module ??
      "export default { fetch() { return new Response('PR module'); } };",
  );
  if (extraWorker) {
    mkdirSync(join(directory, ".cloudflare/output/v0/workers/attacker"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, ".cloudflare/output/v0/workers/attacker/worker.js"),
      "export default { fetch() { return new Response('other target'); } };",
    );
  }
  writeFileSync(
    join(directory, ".cloudflare/site-manifest.json"),
    JSON.stringify({ pages: ["/"], assets: ["/index.html"] }),
  );
  const bytes = createPublicationArchive(directory);
  return { bytes, checksum: archiveChecksum(bytes) };
}

test("trusted compilation is anchored to its control checkout and deterministic", async () => {
  const expected = await execFile("git", ["rev-parse", "HEAD"], {
      cwd: resolve("."),
    }),
    directory = mkdtempSync(join(tmpdir(), "obsidian-worker-cwd-"));
  try {
    const compiled = await compilePrivateWorker({ mode: "preview", images });
    assert.equal(compiled.controlSha, expected.stdout.trim());
    assert.equal(compiled.attestation.controlSha, compiled.controlSha);
    assert.equal(compiled.attestation.moduleHash, compiled.moduleHash);
    assert.equal(compiled.attestation.configHash, compiled.configHash);
    assert.equal(
      compiled.attestation.outputConfigHash,
      compiled.outputConfigHash,
    );
    assert.equal(compiled.attestation.allowlistHash, compiled.allowlistHash);
    assert.ok(compiled.moduleBytes.includes(Buffer.from("/__obsidian/media/")));
    assert.ok(compiled.moduleBytes.includes(Buffer.from(imageKey)));
    process.chdir(directory);
    const fromUntrustedCwd = await compilePrivateWorker({
      mode: "preview",
      images,
    });
    assert.equal(fromUntrustedCwd.controlSha, compiled.controlSha);
    assert.deepEqual(fromUntrustedCwd.moduleBytes, compiled.moduleBytes);
  } finally {
    process.chdir(originalWorkingDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("compiled private Worker config is fixed for preview and staging", async () => {
  for (const mode of ["preview", "staging"]) {
    const compiled = await compilePrivateWorker({ mode, images: {} }),
      config = JSON.parse(compiled.configBytes.toString("utf8")),
      output = JSON.parse(compiled.outputConfigBytes.toString("utf8"));
    assert.deepEqual(Object.keys(config.env).sort(), [
      "ASSETS",
      "OBSIDIAN_SOURCE",
    ]);
    assert.deepEqual(config.env.OBSIDIAN_SOURCE, {
      type: "r2",
      name: "justindfuller-obsidian-source",
    });
    assert.deepEqual(
      config.domains,
      mode === "staging" ? ["staging.justindfuller.com"] : [],
    );
    assert.equal(config.workersDev, mode === "preview");
    assert.equal(config.previewUrls, mode !== "staging");
    assert.deepEqual(output, {
      accountId: account,
      buildContext: { isPreview: mode === "preview", mode },
    });
  }
});

test("allowlist compilation rejects malformed image records and modes", async () => {
  const malformed = [
    { ...images, [`v1/${"c".repeat(64)}.png`]: images[imageKey] },
    { [imageKey]: { ...images[imageKey], md5: "bad" } },
    { [imageKey]: { ...images[imageKey], size: 20 * 1024 * 1024 + 1 } },
    { [imageKey]: { ...images[imageKey], contentType: "text/plain" } },
    { [imageKey]: { ...images[imageKey], extra: true } },
  ];
  for (const value of malformed)
    await assert.rejects(
      compilePrivateWorker({ mode: "preview", images: value }),
      /allowlist/,
    );
  await assert.rejects(
    compilePrivateWorker({ mode: "production", images: {} }),
    /mode/,
  );
});

test("repackaging replaces PR Worker code and removes all other runtime modules", async (t) => {
  const source = mkdtempSync(join(tmpdir(), "obsidian-worker-source-"));
  t.after(() => rmSync(source, { recursive: true, force: true }));
  const malicious =
      "export default { async fetch(request, env) { const page = await env.OBSIDIAN_SOURCE.list(); const item = await env.OBSIDIAN_SOURCE.get(page.objects[0].key); return new Response(await item.text()); } };",
    original = fixtureArchive(source, { module: malicious, extraWorker: true }),
    compiled = await compilePrivateWorker({ mode: "preview", images }),
    packaged = await repackagePrivateWorkerArchive(
      original.bytes,
      original.checksum,
      compiled,
    );
  assert.throws(
    () =>
      validatePrivateWorkerArchive(original.bytes, original.checksum, compiled),
    /differs from trusted compilation/,
  );
  assert.equal(
    validatePrivateWorkerArchive(packaged.bytes, packaged.checksum, compiled)
      .moduleHash,
    compiled.moduleHash,
  );
  const entries = inspectPublicationArchive(packaged.bytes, packaged.checksum),
    files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.name, entry.bytes]),
    ),
    module = files.get(
      ".cloudflare/output/v0/workers/default/bundle/private.js",
    );
  assert.deepEqual(module, compiled.moduleBytes);
  assert.equal(module.includes(Buffer.from("OBSIDIAN_SOURCE.list()")), false);
  assert.equal(
    entries.some((entry) => entry.name.includes("/workers/attacker/")),
    false,
  );
  assert.deepEqual(
    JSON.parse(
      files.get(".cloudflare/output/v0/workers/default/worker.config.json"),
    ).manifest,
    {
      type: "complete",
      mainModule: "private.js",
      modules: { "private.js": { type: "esm" } },
    },
  );
});

test("retained proof accepts an older control SHA but rejects altered bytes, images, or proof fields", async (t) => {
  const source = mkdtempSync(join(tmpdir(), "obsidian-worker-retained-"));
  t.after(() => rmSync(source, { recursive: true, force: true }));
  const original = fixtureArchive(source),
    compiled = await compilePrivateWorker({ mode: "preview", images }),
    packaged = await repackagePrivateWorkerArchive(
      original.bytes,
      original.checksum,
      compiled,
    ),
    historical = {
      ...compiled.attestation,
      controlSha: "f".repeat(40),
    };
  assert.equal(
    validateRetainedPrivateWorkerArchive(packaged.bytes, packaged.checksum, {
      account,
      mode: "preview",
      images,
      attestation: historical,
    }).controlSha,
    "f".repeat(40),
  );
  assert.throws(
    () =>
      validateRetainedPrivateWorkerArchive(packaged.bytes, packaged.checksum, {
        account,
        mode: "preview",
        images: {},
        attestation: historical,
      }),
    /attestation is invalid/,
  );
  assert.throws(
    () =>
      validateRetainedPrivateWorkerArchive(packaged.bytes, packaged.checksum, {
        account,
        mode: "staging",
        images,
        attestation: historical,
      }),
    /attestation is invalid/,
  );
  assert.throws(
    () =>
      validateRetainedPrivateWorkerArchive(packaged.bytes, packaged.checksum, {
        account,
        mode: "preview",
        images,
        attestation: { ...historical, extra: true },
      }),
    /attestation is invalid/,
  );
  const extracted = mkdtempSync(join(tmpdir(), "obsidian-worker-tamper-"));
  t.after(() => rmSync(extracted, { recursive: true, force: true }));
  restorePublicationArchive(packaged.bytes, packaged.checksum, extracted);
  writeFileSync(
    join(extracted, ".cloudflare/output/v0/workers/default/bundle/private.js"),
    "export default { fetch() { return new Response('tampered'); } };",
  );
  const tampered = createPublicationArchive(extracted);
  assert.throws(
    () =>
      validateRetainedPrivateWorkerArchive(
        tampered,
        archiveChecksum(tampered),
        {
          account,
          mode: "preview",
          images,
          attestation: historical,
        },
      ),
    /compilation proof is invalid/,
  );
});
