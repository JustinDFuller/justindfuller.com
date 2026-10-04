import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PublicationTransaction,
  targetNamespace,
} from "./obsidian-transaction.mjs";

const candidate = {
  source: "a".repeat(64),
  code: "b".repeat(64),
  digest: "c".repeat(64),
  artifact: "d".repeat(64),
  state: { mode: "staging" },
  archive: "private-build",
  verification: { pages: [] },
};
function setup(namespace = "staging") {
  const objects = new Map();
  const store = {
    get: async (key) => objects.get(key),
    put: async (key, bytes) => {
      objects.set(key, bytes);
    },
  };
  let live = "prior-version",
    deployments = 0,
    failVerify = false,
    failRollback = false;
  const serving = {
    identity: async () => live,
    capture: async (deployment) => ({
      deployment,
      artifact: "e".repeat(64),
      archive: "prior-private-build",
      verification: { pages: [] },
    }),
    deploy: async () => {
      live = `candidate-${++deployments}`;
      return live;
    },
    rollback: async (identity) => {
      if (failRollback) throw new Error("rollback failure");
      live = identity;
    },
    verify: async (receipt) => {
      if (
        receipt.deployment !== live ||
        (failVerify && live.startsWith("candidate"))
      )
        throw new Error("verification failed");
    },
  };
  return {
    objects,
    store,
    serving,
    transaction: new PublicationTransaction(store, serving, namespace),
    live: () => live,
    deployments: () => deployments,
    failVerification: () => {
      failVerify = true;
    },
    failRollback: () => {
      failRollback = true;
    },
  };
}

test("state promotion follows live verification, survives fresh runners and skips only proven output", async () => {
  const env = setup();
  const result = await env.transaction.publish(candidate, { bootstrap: true });
  assert.equal(result.skipped, false);
  assert.equal(result.accepted.receipt.deployment, env.live());
  const fresh = new PublicationTransaction(env.store, env.serving, "staging");
  const next = await fresh.publish({ ...candidate, source: "f".repeat(64) });
  assert.equal(next.skipped, true);
  assert.equal(env.deployments(), 1);
  assert.equal(next.accepted.source, "f".repeat(64));
  assert.equal((await fresh.read(fresh.journalKey)).phase, "promoted");
});

test("failed verification restores the captured version without promoting candidate state", async () => {
  const env = setup();
  env.failVerification();
  await assert.rejects(
    env.transaction.publish(candidate, { bootstrap: true }),
    /restored and verified/,
  );
  assert.equal(env.live(), "prior-version");
  assert.equal(
    await env.transaction.read(env.transaction.currentKey),
    undefined,
  );
  assert.equal(
    (await env.transaction.read(env.transaction.journalKey)).phase,
    "rolled_back",
  );
});

test("unverified rollback leaves an incident journal and never accepts an orphan deployment", async () => {
  const env = setup();
  env.failVerification();
  env.failRollback();
  await assert.rejects(
    env.transaction.publish(candidate, { bootstrap: true }),
    /rollback is unverified/,
  );
  assert.equal(
    (await env.transaction.read(env.transaction.journalKey)).phase,
    "incident",
  );
  assert.equal(
    await env.transaction.read(env.transaction.currentKey),
    undefined,
  );
  await assert.rejects(
    new PublicationTransaction(env.store, env.serving, "staging").reconcile(),
  );
});

test("ambiguous promotion is reconciled against the live identity and artifact before acceptance", async () => {
  const env = setup();
  let failed = false;
  const original = env.store.put;
  env.store.put = async (key, bytes) => {
    await original(key, bytes);
    if (key === env.transaction.currentKey && !failed) {
      failed = true;
      throw new Error("write response lost");
    }
  };
  await assert.rejects(env.transaction.publish(candidate, { bootstrap: true }));
  assert.equal(
    (await env.transaction.read(env.transaction.journalKey)).phase,
    "verified",
  );
  await new PublicationTransaction(
    env.store,
    env.serving,
    "staging",
  ).reconcile();
  assert.equal(
    (await env.transaction.read(env.transaction.journalKey)).phase,
    "promoted",
  );
  assert.equal(
    (await env.transaction.read(env.transaction.currentKey)).receipt.deployment,
    env.live(),
  );
});

test("production, staging and each PR have isolated accepted state and journals", async () => {
  assert.equal(targetNamespace("preview", 2), "pr/2");
  assert.throws(() => targetNamespace("production", 2));
  const env = setup();
  await env.transaction.publish(candidate, { bootstrap: true });
  for (const target of ["production", "pr/2", "pr/3"]) {
    const tx = new PublicationTransaction(env.store, env.serving, target);
    assert.equal(await tx.read(tx.currentKey), undefined);
    assert.equal(await tx.read(tx.journalKey), undefined);
  }
  env.objects.set(
    "accepted/pr/2/current.json",
    env.objects.get(env.transaction.currentKey),
  );
  await assert.rejects(
    new PublicationTransaction(env.store, env.serving, "pr/2").read(
      "accepted/pr/2/current.json",
    ),
    /envelope mismatch/,
  );
});
