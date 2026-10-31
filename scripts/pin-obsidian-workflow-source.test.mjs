import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PinFailure,
  pinFailureReasons,
  pinFailureSummary,
  pinWorkflowSource,
} from "./pin-obsidian-workflow-source.mjs";

const account = "a".repeat(32);
const revision = "b".repeat(64);
const privateText =
  "justindfuller-obsidian-source/secret-key /private/tmp/path";

const acceptedState = {
  version: 1,
  namespace: "staging",
  source: revision,
  state: { version: 1, mode: "staging", revision },
  receipt: { deployment: "deployment" },
};

let closed = 0;

const transportFor = (bytes, failure) => ({
  close() {
    closed++;
  },
  async head() {
    if (failure) throw new Error(privateText);
    if (!bytes) return undefined;
    return {
      contentLength: bytes.byteLength,
      metadata: {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        md5: createHash("md5").update(bytes).digest("hex"),
      },
    };
  },
  async get() {
    return bytes;
  },
});

const pinnedSource = {
  revision,
  snapshot: { version: 1, files: {}, images: {} },
  bodies: {},
  ready: {},
};

let lastOutput = "";

async function run(options) {
  const cwd = await mkdtemp(join(tmpdir(), "pin-test-"));
  await mkdir(join(cwd, ".obsidian-publish"), { recursive: true });
  const original = process.cwd(),
    outputFile = join(cwd, "github-output");
  process.chdir(cwd);
  const previousOutput = process.env.GITHUB_OUTPUT;
  process.env.GITHUB_OUTPUT = outputFile;
  try {
    return await pinWorkflowSource({
      mode: "staging",
      account,
      cwd,
      targetWorkspace: cwd,
      ...options,
      execute:
        options.execute ??
        (async (_binary, args) => {
          const out = args[args.indexOf("--out") + 1];
          await writeFile(
            join(cwd, out),
            JSON.stringify(options.pinned ?? pinnedSource),
          );
        }),
    });
  } finally {
    lastOutput = await readFile(outputFile, "utf8").catch(() => "");
    process.chdir(original);
    if (previousOutput === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = previousOutput;
    await rm(cwd, { recursive: true, force: true });
  }
}

const accepted = Buffer.from(JSON.stringify(acceptedState));

async function failure(options) {
  try {
    await run(options);
  } catch (error) {
    return error;
  }
  assert.fail("expected the pin to fail");
}

test("an unsupported target is reported as an invalid target", async () => {
  const error = await failure({
    mode: "local",
    transportFactory: () => transportFor(accepted),
  });
  assert.deepEqual(pinFailureSummary(error), { reason: "invalid_target" });
});

test("an invalid account is reported as an invalid target", async () => {
  const error = await failure({
    account: "short",
    transportFactory: () => transportFor(accepted),
  });
  assert.equal(pinFailureSummary(error).reason, "invalid_target");
});

test("a state store that cannot be created is reported as unreachable", async () => {
  const error = await failure({
    transportFactory: () => {
      throw new Error(privateText);
    },
  });
  assert.equal(pinFailureSummary(error).reason, "state_store_unreachable");
});

test("a state store read failure is reported as unreachable", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted, true),
  });
  assert.equal(pinFailureSummary(error).reason, "state_store_unreachable");
});

test("missing accepted state without bootstrap is reported as unavailable", async () => {
  const error = await failure({
    mode: "preview",
    pr: 7,
    transportFactory: () => transportFor(undefined),
  });
  assert.deepEqual(pinFailureSummary(error), {
    reason: "accepted_state_unavailable",
  });
});

test("missing staging state is unavailable even when a skip is requested", async () => {
  const error = await failure({
    mode: "staging",
    transportFactory: () => transportFor(undefined),
  });
  assert.deepEqual(pinFailureSummary(error), {
    reason: "accepted_state_unavailable",
  });
});

test("a skip is refused for a target that is not a preview", async () => {
  for (const mode of ["production", "staging"]) {
    const error = await failure({
      mode,
      skipIfMissing: true,
      transportFactory: () => transportFor(undefined),
    });
    assert.deepEqual(pinFailureSummary(error), { reason: "invalid_target" });
  }
});

test("a preview with no accepted state is skipped with a notice when requested", async () => {
  const printed = [],
    log = console.log;
  console.log = (...args) => printed.push(args.join(" "));
  let pinned = false;
  try {
    const result = await run({
      mode: "preview",
      pr: 7,
      skipIfMissing: true,
      transportFactory: () => transportFor(undefined),
      execute: async () => {
        pinned = true;
      },
    });
    assert.deepEqual(result, { version: 1, target: "pr/7", noPreview: true });
  } finally {
    console.log = log;
  }
  assert.equal(pinned, false);
  assert.equal(lastOutput, "no_preview=true\n");
  assert.equal(printed.length, 1);
  assert.match(printed[0], /^::notice /);
  assert.match(printed[0], /No private preview exists for this pull request/);
  for (const part of [...privateText.split(" "), account, revision, "pr/7"])
    assert.ok(!printed[0].includes(part), printed[0]);
});

test("a preview with accepted state is still pinned when a skip is requested", async () => {
  const result = await run({
    mode: "preview",
    pr: 7,
    skipIfMissing: true,
    transportFactory: () =>
      transportFor(
        Buffer.from(
          JSON.stringify({
            ...acceptedState,
            namespace: "pr/7",
            state: { version: 1, mode: "preview", revision },
          }),
        ),
      ),
  });
  assert.equal(result.noPreview, undefined);
  assert.equal(result.sourceUnavailable, false);
  assert.match(lastOutput, /^source_unavailable=false\n/);
});

test("bootstrap takes precedence over a requested skip", async () => {
  let pinned = false;
  const result = await run({
    mode: "preview",
    pr: 7,
    bootstrap: true,
    skipIfMissing: true,
    transportFactory: () => transportFor(undefined),
    execute: async (_binary, args) => {
      pinned = true;
      await writeFile(
        join(process.cwd(), args[args.indexOf("--out") + 1]),
        JSON.stringify(pinnedSource),
      );
    },
  });
  assert.equal(pinned, true);
  assert.equal(result.noPreview, undefined);
});

test("a requested skip does not hide an unreadable or unusable state", async () => {
  const cases = [
    [() => transportFor(accepted, true), "state_store_unreachable"],
    [() => transportFor(Buffer.from("{not json")), "accepted_state_invalid"],
    [
      () =>
        transportFor(
          Buffer.from(JSON.stringify({ ...acceptedState, namespace: "other" })),
        ),
      "accepted_state_incompatible",
    ],
  ];
  for (const [transportFactory, reason] of cases) {
    const error = await failure({
      mode: "preview",
      pr: 7,
      skipIfMissing: true,
      transportFactory,
    });
    assert.equal(pinFailureSummary(error).reason, reason);
  }
});

test("unparseable accepted state is reported as invalid", async () => {
  const error = await failure({
    transportFactory: () => transportFor(Buffer.from("{not json")),
  });
  assert.equal(pinFailureSummary(error).reason, "accepted_state_invalid");
});

test("accepted state for another target is reported as incompatible", async () => {
  const error = await failure({
    transportFactory: () =>
      transportFor(
        Buffer.from(JSON.stringify({ ...acceptedState, namespace: "other" })),
      ),
  });
  assert.equal(pinFailureSummary(error).reason, "accepted_state_incompatible");
});

test("a failing pin process reports its exit code and flags", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted),
    execute: async () => {
      throw Object.assign(new Error(privateText), {
        code: 3,
        killed: false,
        signal: null,
        stderr: privateText,
      });
    },
  });
  assert.deepEqual(pinFailureSummary(error), {
    reason: "source_pin_failed",
    exitCode: 3,
    timedOut: false,
    signaled: false,
  });
});

test("a timed out pin process is reported as timed out and signaled", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted),
    execute: async () => {
      throw Object.assign(new Error(privateText), {
        code: null,
        killed: true,
        signal: "SIGTERM",
      });
    },
  });
  assert.deepEqual(pinFailureSummary(error), {
    reason: "source_pin_failed",
    exitCode: -1,
    timedOut: true,
    signaled: true,
  });
});

test("a pin process that writes no source is reported as unreadable", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted),
    execute: async () => {},
  });
  assert.equal(pinFailureSummary(error).reason, "pinned_source_unreadable");
});

test("a pinned source with the wrong shape is reported as invalid", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted),
    pinned: { revision: "short" },
  });
  assert.equal(pinFailureSummary(error).reason, "pinned_source_invalid");
});

test("an unavailable source is not a failure", async () => {
  const result = await run({
    transportFactory: () => transportFor(accepted),
    execute: async () => {
      throw Object.assign(new Error(privateText), { code: 10 });
    },
  });
  assert.deepEqual(result, {
    version: 1,
    target: "staging",
    sourceUnavailable: true,
  });
  assert.equal(lastOutput, "source_unavailable=true\n");
});

test("a valid source is pinned", async () => {
  const result = await run({ transportFactory: () => transportFor(accepted) });
  assert.equal(result.sourceUnavailable, false);
  assert.equal(result.source, revision);
  assert.equal(
    lastOutput,
    `source_unavailable=false\npinned_source=.obsidian-publish/hosted/staging/pinned.json\nrevision=${revision}\n`,
  );
});

test("a missing accepted state is allowed when bootstrapping", async () => {
  let pinArguments;
  const result = await run({
    bootstrap: true,
    transportFactory: () => transportFor(undefined),
    execute: async (_binary, args) => {
      pinArguments = args;
      await writeFile(
        join(process.cwd(), args[args.indexOf("--out") + 1]),
        JSON.stringify(pinnedSource),
      );
    },
  });
  assert.equal(result.sourceUnavailable, false);
  assert.ok(!pinArguments.includes("--state"));
});

test("the state store connection is closed after success and failure", async () => {
  const before = closed;
  await run({ transportFactory: () => transportFor(accepted) });
  await failure({ transportFactory: () => transportFor(accepted, true) });
  assert.equal(closed, before + 2);
});

test("a pinned source that is not JSON is reported as invalid", async () => {
  const error = await failure({
    transportFactory: () => transportFor(accepted),
    execute: async (_binary, args) => {
      await writeFile(
        join(process.cwd(), args[args.indexOf("--out") + 1]),
        "{not json",
      );
    },
  });
  assert.equal(pinFailureSummary(error).reason, "pinned_source_invalid");
});

test("an unclassified error is reported as unknown", () => {
  assert.deepEqual(pinFailureSummary(new Error(privateText)), {
    reason: "unknown",
  });
  assert.deepEqual(pinFailureSummary(undefined), { reason: "unknown" });
  assert.deepEqual(pinFailureSummary(new PinFailure("made_up")), {
    reason: "unknown",
  });
});

test("error text never appears in the reported summary", async () => {
  const errors = [
    await failure({
      transportFactory: () => {
        throw new Error(privateText);
      },
    }),
    await failure({
      transportFactory: () => transportFor(accepted, true),
    }),
    await failure({
      transportFactory: () => transportFor(accepted),
      execute: async () => {
        throw Object.assign(new Error(privateText), {
          code: 2,
          stderr: privateText,
          stdout: privateText,
          cmd: privateText,
        });
      },
    }),
    new Error(privateText),
  ];
  for (const error of errors) {
    const printed = JSON.stringify(pinFailureSummary(error));
    for (const part of privateText.split(" "))
      assert.ok(!printed.includes(part), printed);
    assert.ok(
      ["unknown", ...pinFailureReasons].includes(JSON.parse(printed).reason),
    );
    assert.deepEqual(
      Object.keys(JSON.parse(printed)).filter(
        (key) => !["reason", "exitCode", "timedOut", "signaled"].includes(key),
      ),
      [],
    );
  }
});

test("the command prints its message and one reason line and exits with 1", () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("./pin-obsidian-workflow-source.mjs", import.meta.url),
      ),
      "--mode",
      "local",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.deepEqual(result.stderr.trim().split("\n"), [
    "Trusted private source pin failed",
    JSON.stringify({ reason: "invalid_target" }),
  ]);
});
