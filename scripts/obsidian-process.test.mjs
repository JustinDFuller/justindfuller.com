import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicationEnvironment,
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

test("captured subprocess failures never expose private output or exception payloads", async () => {
  await assert.rejects(
    runPublicationCommand(
      process.execPath,
      ["-e", "console.error('private-post-slug canary'); process.exit(1)"],
      { purpose: "build" },
    ),
    (error) =>
      !error.message.includes("canary") &&
      !error.message.includes("private-post-slug") &&
      error.stderr === undefined,
  );
});
