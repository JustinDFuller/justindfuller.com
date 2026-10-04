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

test("deterministic tested archives preserve private HTML without including raw state or credentials", () => {
  const dir = fixture(),
    restored = mkdtempSync(join(tmpdir(), "obsidian-restored-"));
  try {
    const bytes = createPublicationArchive(dir),
      hash = archiveChecksum(bytes);
    assert.deepEqual(createPublicationArchive(dir), bytes);
    assert.equal(bytes.includes(Buffer.from("private canary HTML")), true);
    assert.equal(
      bytes.includes(Buffer.from("secret credential canary")),
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
    corrupt[600] ^= 1;
    assert.throws(
      () => restorePublicationArchive(corrupt, hash, restored),
      /checksum/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
  }
});

test("checksummed archive traversal, links and unsupported metadata are rejected before extraction", () => {
  const dir = fixture();
  try {
    const bytes = createPublicationArchive(dir);
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
