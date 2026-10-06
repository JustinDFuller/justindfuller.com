import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeRuntimeState } from "../src/runtime.ts";

test("runtime updates replace existing state and preserve both target statuses", async () => {
  const directory = await mkdtemp(join(tmpdir(), "obsidian-runtime-"));
  const path = join(directory, "publisher-state.json");
  try {
    await writeRuntimeState(path, JSON.stringify({ staging: "verified" }));
    const state = { staging: "verified", production: "verified" };
    await writeRuntimeState(path, JSON.stringify(state));
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), state);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(directory), ["publisher-state.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed runtime replacement preserves the destination and removes its temporary file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "obsidian-runtime-"));
  const path = join(directory, "publisher-state.json");
  try {
    await mkdir(path);
    await assert.rejects(writeRuntimeState(path, "new state"));
    assert.equal((await stat(path)).isDirectory(), true);
    assert.deepEqual(await readdir(directory), ["publisher-state.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
