import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PublisherScheduler,
  ProviderError,
  type SchedulerState,
} from "../src/scheduler.ts";
import { dispatchContent } from "../src/dispatch.ts";
import { publicationNotices } from "../src/status.ts";

const revision = "a".repeat(64);
test("debounce, maximum age, unchanged reconciliation and single-flight", async () => {
  let now = 0,
    uploads = 0,
    dispatches = 0;
  const scheduler = new PublisherScheduler(
    {},
    {
      now: () => now,
      upload: async () => {
        uploads++;
        return { revision, activated: uploads === 1 };
      },
      dispatch: async () => {
        dispatches++;
      },
      persist: async () => {},
      notice: () => {},
    },
  );
  await scheduler.tick();
  assert.equal(uploads, 1);
  assert.equal(dispatches, 1);
  now = 1000;
  scheduler.edited();
  for (now = 31000; now <= 91000; now += 30000) {
    scheduler.edited();
    await scheduler.tick();
  }
  assert.equal(uploads, 1);
  now = 121000;
  await scheduler.tick();
  assert.equal(uploads, 2);
  assert.equal(dispatches, 1);
  now = 421000;
  await Promise.all([scheduler.tick(), scheduler.tick()]);
  assert.equal(uploads, 3);
  assert.equal(dispatches, 1);
  now = 422000;
  scheduler.edited();
  now = 482000;
  await scheduler.tick();
  assert.equal(uploads, 4);
});

test("dispatch retries survive restart and authentication pauses until manual retry", async () => {
  let now = 0,
    saved: SchedulerState = {},
    attempts = 0;
  const dependencies = {
    now: () => now,
    upload: async () => ({ revision, activated: false }),
    dispatch: async () => {
      attempts++;
      throw new ProviderError(attempts === 1 ? 429 : 401, 600000);
    },
    persist: async (state: SchedulerState) => {
      saved = structuredClone(state);
    },
    notice: () => {},
  };
  let scheduler = new PublisherScheduler({}, dependencies);
  await scheduler.tick();
  assert.equal(saved.pending?.retryAt, 300000);
  now = 100000;
  scheduler = new PublisherScheduler(saved, dependencies);
  await scheduler.tick();
  assert.equal(attempts, 1);
  now = 300000;
  await scheduler.tick();
  assert.equal(saved.pending?.authenticationBlocked, true);
  now = 600000;
  await scheduler.tick();
  assert.equal(attempts, 2);
  await scheduler.manual();
  assert.equal(attempts, 3);
});

test("upload failures retain a pending dispatch and do not dispatch an unactivated revision", async () => {
  let now = 0,
    dispatches = 0;
  const scheduler = new PublisherScheduler(
    {
      revision,
      pending: {
        revision,
        attempts: 0,
        retryAt: 0,
        authenticationBlocked: false,
      },
    },
    {
      now: () => now,
      upload: async () => {
        throw new Error("storage down");
      },
      dispatch: async () => {
        dispatches++;
      },
      persist: async () => {},
      notice: () => {},
    },
  );
  await scheduler.tick();
  assert.equal(dispatches, 1);
  now = 60000;
  await scheduler.tick();
  assert.equal(dispatches, 1);
});

test("workflow dispatch is fixed to trusted main and does not leak response text", async () => {
  let url = "",
    body = "";
  await dispatchContent("credential", revision, async (input, options) => {
    url = String(input);
    body = String(options?.body);
    return new Response(null, { status: 204 });
  });
  assert.equal(
    url,
    "https://api.github.com/repos/JustinDFuller/justindfuller.com/actions/workflows/cloudflare.yml/dispatches",
  );
  assert.deepEqual(JSON.parse(body), {
    ref: "main",
    inputs: { publish_kind: "content", source_revision: revision },
  });
  await assert.rejects(
    dispatchContent(
      "credential",
      revision,
      async () => new Response("private provider error", { status: 403 }),
    ),
    (error) =>
      error instanceof ProviderError && !error.message.includes("private"),
  );
});

test("protected issue notices are deduplicated and recovery stays target-specific", () => {
  const production = {
    version: 1 as const,
    target: "production" as const,
    source: revision,
    status: "degraded" as const,
    issues: [{ key: revision, category: "invalid_metadata" }],
  };
  const first = publicationNotices(production, {});
  assert.equal(first.notices.length, 1);
  assert.equal(publicationNotices(production, first.state).notices.length, 0);
  const staging = publicationNotices(
    {
      version: 1,
      target: "staging",
      source: revision,
      status: "verified",
      issues: [],
    },
    first.state,
  );
  assert.deepEqual(staging.state.production, first.state.production);
  const recovered = publicationNotices(
    { ...production, status: "verified", issues: [] },
    staging.state,
  );
  assert.deepEqual(recovered.notices, ["production: publication recovered"]);
});

test("restart checks both verified target reports before redispatching an ambiguous success", async () => {
  let dispatches = 0,
    recoveries = 0;
  const state = {
    revision,
    pending: {
      revision,
      attempts: 1,
      retryAt: 0,
      authenticationBlocked: false,
    },
  };
  const scheduler = new PublisherScheduler(state, {
    now: () => 0,
    upload: async () => ({ revision, activated: false }),
    dispatch: async () => {
      dispatches++;
    },
    persist: async () => {},
    notice: () => {},
    recovered: async (current) => {
      recoveries++;
      assert.equal(current, revision);
      return true;
    },
  });
  await scheduler.tick();
  assert.equal(recoveries, 1);
  assert.equal(dispatches, 0);
  assert.equal(scheduler.state.pending, undefined);
});

test("upload retry backoff grows to five minutes and successful uploads reset it", async () => {
  let now = 0,
    uploads = 0;
  const scheduler = new PublisherScheduler(
    {},
    {
      now: () => now,
      upload: async () => {
        uploads++;
        throw new Error("unavailable");
      },
      dispatch: async () => {
        throw new Error("must not dispatch");
      },
      persist: async () => {},
      notice: () => {},
    },
  );
  for (const at of [0, 60000, 180000, 420000, 720000]) {
    now = at;
    await scheduler.tick();
  }
  assert.equal(uploads, 5);
  now = 1019999;
  await scheduler.tick();
  assert.equal(uploads, 5);
  now = 1020000;
  await scheduler.tick();
  assert.equal(uploads, 6);
  assert.equal(new ProviderError(429, NaN).retryAfter, 0);
});
