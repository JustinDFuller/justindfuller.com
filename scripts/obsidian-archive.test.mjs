import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  createPublicationArchive,
  inspectPublicationArchive,
  restorePublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "obsidian-archive-"));
  mkdirSync(join(dir, "dist/private-canary-post"), { recursive: true });
  mkdirSync(join(dir, ".cloudflare/output"), { recursive: true });
  writeFileSync(
    join(dir, "dist/private-canary-post/index.html"),
    "private canary HTML",
  );
  writeFileSync(join(dir, ".cloudflare/output/config.json"), "{}");
  writeFileSync(join(dir, ".cloudflare/site-manifest.json"), "{}");
  mkdirSync(join(dir, ".obsidian-publish"));
  writeFileSync(
    join(dir, ".obsidian-publish/state.json"),
    "secret credential canary",
  );
  return dir;
}

function legacyTar() {
  const records = [];
  for (const [name, content] of [
    ["dist/", Buffer.alloc(0)],
    ["dist/private-canary-post/", Buffer.alloc(0)],
    ["dist/private-canary-post/index.html", Buffer.from("private canary HTML")],
    [".cloudflare/output/", Buffer.alloc(0)],
    [".cloudflare/output/config.json", Buffer.from("{}")],
    [".cloudflare/site-manifest.json", Buffer.from("{}")],
  ]) {
    const directory = name.endsWith("/"),
      value = directory ? Buffer.alloc(0) : content,
      header = Buffer.alloc(512);
    header.write(name.replace(/\/$/, ""), 0, 100);
    for (const [offset, size, number] of [
      [100, 8, directory ? 0o700 : 0o600],
      [108, 8, 0],
      [116, 8, 0],
      [124, 12, value.length],
      [136, 12, 0],
    ])
      header.write(
        `${number.toString(8).padStart(size - 1, "0")}\0`,
        offset,
        size,
      );
    header.fill(32, 148, 156);
    header.write(directory ? "5" : "0", 156);
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
    records.push(
      header,
      value,
      Buffer.alloc((512 - (value.length % 512)) % 512),
    );
  }
  return Buffer.concat([...records, Buffer.alloc(1024)]);
}

test("deterministic tested archives preserve private HTML without including raw state or credentials", () => {
  const dir = fixture(),
    restored = mkdtempSync(join(tmpdir(), "obsidian-restored-"));
  try {
    const bytes = createPublicationArchive(dir),
      hash = archiveChecksum(bytes);
    assert.deepEqual(createPublicationArchive(dir), bytes);
    assert.equal(
      gunzipSync(bytes).includes(Buffer.from("private canary HTML")),
      true,
    );
    assert.equal(
      gunzipSync(bytes).includes(Buffer.from("secret credential canary")),
      false,
    );
    restorePublicationArchive(bytes, hash, restored);
    assert.equal(
      readFileSync(
        join(restored, "dist/private-canary-post/index.html"),
        "utf8",
      ),
      "private canary HTML",
    );
    assert.equal(
      existsSync(join(restored, ".obsidian-publish/state.json")),
      false,
    );
    const corrupt = Buffer.from(bytes);
    corrupt[20] ^= 1;
    assert.throws(
      () => restorePublicationArchive(corrupt, hash, restored),
      /checksum|compressed/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
  }
});

test("checksummed archive traversal, links and unsupported metadata are rejected before extraction", () => {
  const dir = fixture();
  try {
    const bytes = legacyTar();
    for (const change of [
      (header) => {
        header.fill(0, 0, 100);
        header.write("dist/../../escape");
      },
      (header) => {
        header.write("2", 156);
        header.write("/tmp/escape", 157);
      },
      (header) => {
        header.write("x", 156);
      },
    ]) {
      const corrupt = Buffer.from(bytes),
        header = corrupt.subarray(0, 512);
      change(header);
      header.fill(32, 148, 156);
      const sum = header.reduce((total, value) => total + value, 0);
      header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
      assert.throws(
        () => inspectPublicationArchive(corrupt, archiveChecksum(corrupt)),
        /Unsafe/,
      );
    }
    symlinkSync(
      join(dir, ".obsidian-publish/state.json"),
      join(dir, "dist/secret-link"),
    );
    assert.throws(() => createPublicationArchive(dir), /nonregular/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("archive restore refuses a linked Cloudflare destination", () => {
  const dir = fixture(),
    restored = mkdtempSync(join(tmpdir(), "obsidian-restored-"));
  try {
    const bytes = createPublicationArchive(dir);
    symlinkSync(join(dir, ".cloudflare"), join(restored, ".cloudflare"));
    assert.throws(
      () => restorePublicationArchive(bytes, archiveChecksum(bytes), restored),
      /Unsafe/,
    );
    assert.equal(
      readFileSync(join(dir, ".cloudflare/output/config.json"), "utf8"),
      "{}",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
  }
});

test("compressed archives are deterministic, checksummed as stored, and bounded", () => {
  const dir = fixture();
  try {
    const bytes = createPublicationArchive(dir);
    assert.deepEqual(createPublicationArchive(dir), bytes);
    assert.equal(bytes[0], 0x1f);
    assert.equal(
      inspectPublicationArchive(bytes, archiveChecksum(bytes)).some(
        (entry) => entry.name === "dist/private-canary-post/index.html",
      ),
      true,
    );
    assert.throws(
      () =>
        inspectPublicationArchive(
          bytes.subarray(0, bytes.length - 1),
          archiveChecksum(bytes.subarray(0, bytes.length - 1)),
        ),
      /compressed|Incomplete|Invalid/,
    );
    const shared = Buffer.alloc(14_000),
      entries = [
        { name: "dist", directory: true },
        { name: ".cloudflare/output", directory: true },
        { name: ".cloudflare/site-manifest.json", offset: 0, length: 0 },
        ...Array.from({ length: 19_500 }, (_, index) => ({
          name: `dist/file-${index}`,
          offset: 0,
          length: shared.length,
        })),
      ],
      manifest = Buffer.from(JSON.stringify(entries)),
      envelope = Buffer.concat([
        Buffer.from("OBSARC2\n"),
        Buffer.from([
          manifest.length >>> 24,
          manifest.length >>> 16,
          manifest.length >>> 8,
          manifest.length,
        ]),
        manifest,
        shared,
      ]),
      repeated = gzipSync(envelope);
    assert.throws(
      () => inspectPublicationArchive(repeated, archiveChecksum(repeated)),
      /Unsafe archive entry/,
    );
    const oversized = gzipSync(Buffer.alloc(256 * 1024 * 1024 + 1));
    assert.throws(
      () => inspectPublicationArchive(oversized, archiveChecksum(oversized)),
      /compressed|limit/,
    );
    assert.ok(gunzipSync(bytes).length < 1024 * 1024);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy uncompressed tar archives remain readable", () => {
  const bytes = legacyTar();
  assert.equal(
    inspectPublicationArchive(bytes, archiveChecksum(bytes)).some(
      (entry) => entry.name === "dist/private-canary-post/index.html",
    ),
    true,
  );
});
