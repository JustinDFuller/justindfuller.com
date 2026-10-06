import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promotePreparedImages } from "./promote-obsidian-images.mjs";
import { readPrivatePreparation } from "./prepare-obsidian-target.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";

async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), "obsidian-image-fallback-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const revision = "a".repeat(64),
    key = `v1/${"b".repeat(64)}.png`,
    missing = `v1/${"c".repeat(64)}.png`,
    overlay = ".obsidian-publish/prepared.json",
    source = ".obsidian-publish/pinned.json",
    trace = [];
  await saveProtectedReport(
    overlay,
    {
      version: 1,
      mode: "production",
      revision,
      images: { [key]: {}, [missing]: {} },
    },
    cwd,
  );
  await saveProtectedReport(
    source,
    {
      revision,
      ready: { [key]: true, [missing]: true },
      privateCanary: "private source body",
    },
    cwd,
  );
  const execute = async (command, args, options) => {
      assert.equal(command, "go");
      assert.deepEqual(args, [
        "run",
        "./cmd/prepare-obsidian",
        "--validate-promotion",
        overlay,
      ]);
      assert.equal(options.purpose, "build");
      trace.push("authorize");
      return { stdout: "private output canary" };
    },
    promote = async () => {
      assert.deepEqual(trace, ["authorize"]);
      trace.push("promote");
      return { verified: [key], unavailable: [missing], copied: 0, bytes: 0 };
    };
  return {
    cwd,
    overlay,
    source,
    revision,
    key,
    missing,
    trace,
    execute,
    promote,
  };
}

test("accepted-state promotion verifies every public destination without requiring a fresh source snapshot", async (t) => {
  const f = await fixture(t),
    result = await promotePreparedImages({
      ...f,
      source: undefined,
      acceptedOnly: true,
    });
  assert.deepEqual(result, {
    verified: 1,
    unavailable: 1,
    copied: 0,
    bytes: 0,
  });
  assert.deepEqual(
    await readPrivatePreparation(
      ".obsidian-publish/unavailable-images.json",
      f.cwd,
    ),
    [f.missing],
  );
  assert.equal(
    (await stat(join(f.cwd, ".obsidian-publish/unavailable-images.json")))
      .mode & 0o777,
    0o600,
  );
  assert.equal(JSON.stringify(result).includes(f.key), false);
  assert.equal(
    (await readPrivatePreparation(f.source, f.cwd)).ready[f.missing],
    true,
  );
});

test("pinned promotion marks only failed destinations unavailable while retaining the private source", async (t) => {
  const f = await fixture(t);
  await promotePreparedImages(f);
  const pinned = await readPrivatePreparation(f.source, f.cwd);
  assert.equal(pinned.ready[f.key], true);
  assert.equal(pinned.ready[f.missing], false);
  assert.equal(pinned.privateCanary, "private source body");
});

test("ambiguous modes, source mismatch, authorization failure and public output paths stop before promotion", async (t) => {
  for (const override of [
    { source: undefined },
    { acceptedOnly: true },
    { out: "public.json" },
    { out: ".obsidian-publish/prepared.json" },
    {
      execute: async () => {
        throw new Error("authorization denied");
      },
    },
  ]) {
    const f = await fixture(t);
    await assert.rejects(promotePreparedImages({ ...f, ...override }));
    assert.equal(f.trace.includes("promote"), false);
  }
  const f = await fixture(t);
  await saveProtectedReport(
    f.source,
    { revision: "d".repeat(64), ready: {} },
    f.cwd,
  );
  await assert.rejects(promotePreparedImages(f), /correlation/);
  assert.deepEqual(f.trace, []);
});

test("incomplete, duplicate and foreign destination results cannot authorize a build", async (t) => {
  for (const result of [
    { verified: [], unavailable: [], copied: 0, bytes: 0 },
    { verified: [], unavailable: ["foreign"], copied: 0, bytes: 0 },
    { verified: [], unavailable: [], copied: -1, bytes: 0 },
  ]) {
    const f = await fixture(t);
    await assert.rejects(
      promotePreparedImages({ ...f, promote: async () => result }),
      /incomplete/,
    );
    assert.equal(
      (await readPrivatePreparation(f.source, f.cwd)).ready[f.missing],
      true,
    );
  }
  const f = await fixture(t);
  await assert.rejects(
    promotePreparedImages({
      ...f,
      promote: async () => ({
        verified: [f.key, f.key],
        unavailable: [f.missing],
        copied: 0,
        bytes: 0,
      }),
    }),
    /incomplete/,
  );
});
