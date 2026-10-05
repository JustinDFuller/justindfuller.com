import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  hiddenAnswer,
  configureCredential,
} from "./configure-obsidian-credential.mjs";

class Terminal extends EventEmitter {
  isTTY = true;
  isRaw = false;
  paused = true;
  setRawMode(raw) {
    this.isRaw = raw;
  }
  isPaused() {
    return this.paused;
  }
  resume() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}

test("local credential entry hides values and restores terminal state after entry or cancellation", async () => {
  for (const cancelled of [false, true]) {
    const input = new Terminal(),
      output = [];
    const answer = hiddenAnswer("Hidden credential: ", input, {
      write: (text) => output.push(text),
    });
    input.emit(
      "data",
      Buffer.from(cancelled ? "secret-canary\u0003" : "secret-canary\r"),
    );
    if (cancelled) await assert.rejects(answer, /cancelled/);
    else assert.equal(await answer, "secret-canary");
    assert.equal(output.join("").includes("secret-canary"), false);
    assert.equal(input.isRaw, false);
    assert.equal(input.paused, true);
    assert.equal(input.listenerCount("data"), 0);
  }
  assert.throws(
    () => hiddenAnswer("Credential: ", { isTTY: false }),
    /interactive/,
  );
});

test("credential setup stores only explicit R2 pairs under an allowed purpose and returns no secrets", async () => {
  for (const kind of [
    "upload",
    "source-read",
    "media-write",
    "state-write",
    "reports",
  ]) {
    const answers = ["a".repeat(32), "b".repeat(64)];
    let stored;
    const result = await configureCredential(
      kind,
      async () => answers.shift(),
      async (credentials) => {
        stored = credentials;
      },
    );
    assert.deepEqual(stored, {
      accessKeyId: "a".repeat(32),
      secretAccessKey: "b".repeat(64),
    });
    assert.deepEqual(result, { status: "stored", kind });
  }
  await assert.rejects(
    configureCredential("arbitrary", async () => {
      throw new Error("Must not prompt");
    }),
    /purpose/,
  );
  let wrote = false;
  await assert.rejects(
    configureCredential(
      "upload",
      async () => "invalid",
      async () => {
        wrote = true;
      },
    ),
    /R2/,
  );
  assert.equal(wrote, false);
});
