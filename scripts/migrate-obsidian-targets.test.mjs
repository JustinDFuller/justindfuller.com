import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("explicit migration changes only the environment field and dry runs preserve bytes", () => {
  const directory = mkdtempSync(join(tmpdir(), "obsidian-migration-"));
  try {
    for (const [legacy, target] of [
      ["prd", "production"],
      ["pr", "nonprod"],
      ["local", "nonprod"],
    ]) {
      const file = join(directory, "post.md"),
        raw = Buffer.from(
          `---\r\nenvironment: ${legacy}\r\ntitle: Private Title\r\n---\r\nOriginal body 😀\r\n`,
        );
      writeFileSync(file, raw);
      const dry = spawnSync(
        process.execPath,
        ["scripts/migrate-obsidian-targets.mjs", file],
        { encoding: "utf8" },
      );
      assert.equal(dry.status, 0, dry.stderr);
      assert.deepEqual(readFileSync(file), raw);
      assert.ok(!dry.stdout.includes("Private Title"));
      const changed = spawnSync(
        process.execPath,
        ["scripts/migrate-obsidian-targets.mjs", file, "--write"],
        { encoding: "utf8" },
      );
      assert.equal(changed.status, 0, changed.stderr);
      assert.deepEqual(
        readFileSync(file),
        Buffer.from(
          raw
            .toString()
            .replace(`environment: ${legacy}`, `environment: ${target}`),
        ),
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
