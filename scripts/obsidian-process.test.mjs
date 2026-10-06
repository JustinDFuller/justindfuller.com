import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PublicationSubprocessError,
  publicationEnvironment,
  publicationFailureSummary,
  runPublicationCommand,
} from "./obsidian-process.mjs";

test("publication subprocesses receive only purpose-specific credentials", () => {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GOCACHE: "/tmp/test-cache",
    GITHUB_SHA: "commit",
    GITHUB_TOKEN: "github-secret",
    CLOUDFLARE_API_TOKEN: "production-secret",
    OBSIDIAN_SOURCE_ACCESS_KEY_ID: "source-id",
    OBSIDIAN_SOURCE_SECRET_ACCESS_KEY: "source-secret",
    OBSIDIAN_STATE_ACCESS_KEY_ID: "state-id",
    OBSIDIAN_STATE_SECRET_ACCESS_KEY: "state-secret",
    OBSIDIAN_MEDIA_ACCESS_KEY_ID: "media-id",
    OBSIDIAN_MEDIA_SECRET_ACCESS_KEY: "media-secret",
    CF_ACCESS_CLIENT_ID: "access-id",
    CF_ACCESS_CLIENT_SECRET: "access-secret",
    CLOUDFLARE_ACCESS_API_TOKEN: "access-read-secret",
    NODE_OPTIONS: "untrusted preload",
    CF_ACCESS_CONFIG: "private owner configuration",
  };
  const build = publicationEnvironment(env, "build");
  assert.deepEqual(Object.keys(build).sort(), [
    "GITHUB_SHA",
    "GOCACHE",
    "HOME",
    "PATH",
  ]);
  const prepare = publicationEnvironment(env, "prepare");
  assert.equal(prepare.OBSIDIAN_SOURCE_SECRET_ACCESS_KEY, "source-secret");
  assert.equal(prepare.OBSIDIAN_STATE_SECRET_ACCESS_KEY, undefined);
  const deploy = publicationEnvironment(env, "deploy", "staging-secret");
  assert.equal(deploy.CLOUDFLARE_API_TOKEN, "staging-secret");
  assert.equal(deploy.CF_ACCESS_CLIENT_SECRET, undefined);
  const verify = publicationEnvironment(env, "verify");
  assert.equal(verify.CF_ACCESS_CLIENT_SECRET, "access-secret");
  assert.equal(verify.CLOUDFLARE_API_TOKEN, undefined);
  assert.throws(() => publicationEnvironment(env, "deploy"));
});

test("captured subprocess failures expose only sanitized diagnostic fields", async () => {
  const canary = "private-post-slug-canary-9321";
  let caught;
  await assert.rejects(
    runPublicationCommand(
      process.execPath,
      [
        "-e",
        `console.log(${JSON.stringify(canary)}); console.error('permission denied ${canary}'); process.exit(7)`,
        canary,
      ],
      {
        purpose: "build",
        env: { ...process.env, PRIVATE_TEST_CANARY: canary },
      },
    ),
    (error) => {
      caught = error;
      return error instanceof PublicationSubprocessError;
    },
  );
  assert.equal(
    caught.message,
    "Publication subprocess failed; inspect protected publication state",
  );
  assert.deepEqual(Object.keys(caught).sort(), [
    "commandKind",
    "exitCode",
    "failureCategory",
    "name",
    "signaled",
    "spawnCode",
    "timedOut",
  ]);
  assert.deepEqual(
    {
      commandKind: caught.commandKind,
      exitCode: caught.exitCode,
      spawnCode: caught.spawnCode,
      timedOut: caught.timedOut,
      signaled: caught.signaled,
      failureCategory: caught.failureCategory,
    },
    {
      commandKind: "node",
      exitCode: 7,
      spawnCode: "unknown",
      timedOut: false,
      signaled: false,
      failureCategory: "filesystem-denied",
    },
  );
  const serialized = `${caught.message} ${JSON.stringify(caught)} ${caught.stack}`;
  assert.equal(serialized.includes(canary), false);
  assert.equal(serialized.includes("permission denied"), false);
  assert.equal("cause" in caught, false);
  assert.equal("stdout" in caught, false);
  assert.equal("stderr" in caught, false);
  assert.deepEqual(publicationFailureSummary(caught), {
    commandKind: "node",
    exitCode: 7,
    spawnCode: "unknown",
    timedOut: false,
    signaled: false,
    category: "filesystem-denied",
  });
  assert.deepEqual(publicationFailureSummary(new Error(canary)), {
    category: "unknown",
  });
});

test("spawn failures expose only allowlisted command and spawn classes", async () => {
  let caught;
  await assert.rejects(
    runPublicationCommand("private-command-canary", [], { purpose: "build" }),
    (error) => {
      caught = error;
      return error instanceof PublicationSubprocessError;
    },
  );
  assert.equal(caught.commandKind, "other");
  assert.equal(caught.exitCode, -1);
  assert.equal(caught.spawnCode, "ENOENT");
  assert.equal(caught.failureCategory, "unknown");
  assert.equal(caught.timedOut, false);
  assert.equal(caught.signaled, false);
  assert.equal(
    JSON.stringify(caught).includes("private-command-canary"),
    false,
  );
});
