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
    verifiedPrior,
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
        (failVerify && live.startsWith("candidate") && live !== verifiedPrior)
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
      verifiedPrior = live;
    },
    failRollback: () => {
      failRollback = true;
    },
    setLive: (identity) => {
      live = identity;
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

test("unchanged preparation retains the tested artifact without requiring a build and updates only its own accepted state", async () => {
  const env = setup();
  const initial = await env.transaction.publish(candidate, { bootstrap: true });
  const production = Buffer.from(
    JSON.stringify({
      version: 1,
      namespace: "production",
      source: "production state canary",
    }),
  );
  env.objects.set("accepted/production/current.json", production);
  const prepared = {
    source: "f".repeat(64),
    code: candidate.code,
    digest: candidate.digest,
    state: { mode: "staging", updatedMetadata: true },
  };
  const result = await new PublicationTransaction(
    env.store,
    env.serving,
    "staging",
  ).reconcileUnchanged(prepared);
  assert.equal(result.skipped, true);
  assert.equal(result.accepted.source, prepared.source);
  assert.equal(result.accepted.state.updatedMetadata, true);
  assert.equal(result.accepted.artifact, initial.accepted.artifact);
  assert.equal(result.accepted.archive, initial.accepted.archive);
  assert.deepEqual(result.accepted.verification, initial.accepted.verification);
  assert.deepEqual(result.accepted.receipt, initial.accepted.receipt);
  assert.equal(env.deployments(), 1);
  assert.equal(env.objects.get("accepted/production/current.json"), production);
});

test("changed output or code requires a build while missing state and target mismatches block no-op acceptance", async () => {
  const env = setup();
  const prepared = {
    source: candidate.source,
    code: candidate.code,
    digest: candidate.digest,
    state: candidate.state,
  };
  await assert.rejects(env.transaction.reconcileUnchanged(prepared), /differ/);
  await env.transaction.publish(candidate, { bootstrap: true });
  const before = env.objects.get(env.transaction.currentKey);
  for (const change of [{ code: "e".repeat(64) }, { digest: "e".repeat(64) }])
    assert.equal(
      await env.transaction.reconcileUnchanged({ ...prepared, ...change }),
      undefined,
    );
  assert.equal(env.objects.get(env.transaction.currentKey), before);
  await assert.rejects(
    env.transaction.reconcileUnchanged({
      ...prepared,
      state: { mode: "production" },
    }),
    /target/,
  );
  await assert.rejects(
    env.transaction.reconcileUnchanged({ ...prepared, source: "bad" }),
    /fingerprint/,
  );
  assert.equal(env.deployments(), 1);
});

test("a serving identity change during no-op verification cannot advance reconciliation metadata", async () => {
  const env = setup();
  await env.transaction.publish(candidate, { bootstrap: true });
  const before = env.objects.get(env.transaction.currentKey),
    verify = env.serving.verify;
  env.serving.verify = async (receipt) => {
    await verify(receipt);
    env.setLive("unrelated-deployment");
  };
  await assert.rejects(
    env.transaction.reconcileUnchanged({
      source: "f".repeat(64),
      code: candidate.code,
      digest: candidate.digest,
      state: candidate.state,
    }),
    /changed during no-op/,
  );
  assert.equal(env.objects.get(env.transaction.currentKey), before);
  env.setLive("candidate-1");
  await assert.rejects(
    env.transaction.publish({ ...candidate, source: "f".repeat(64) }),
    /changed during no-op/,
  );
  assert.equal(env.objects.get(env.transaction.currentKey), before);
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

test("preview rollback with a new identity restores the exact prior accepted state", async () => {
  const env = setup("pr/403");
  const first = await env.transaction.publish(candidate, { bootstrap: true });
  env.serving.rollback = async (_identity, receipt) => {
    env.setLive("restored-preview");
    return { ...receipt, deployment: env.live() };
  };
  env.failVerification();
  await assert.rejects(
    env.transaction.publish({ ...candidate, digest: "f".repeat(64) }),
    /restored and verified/,
  );
  const accepted = await env.transaction.read(env.transaction.currentKey);
  assert.equal(accepted.digest, first.accepted.digest);
  assert.equal(accepted.receipt.deployment, "restored-preview");
  assert.equal(accepted.artifact, first.accepted.artifact);
  const journal = await env.transaction.read(env.transaction.journalKey);
  assert.equal(journal.phase, "rolled_back");
  assert.ok(await env.transaction.read(journal.prior.accepted));
});

test("reconciliation never overwrites an unrelated live deployment", async () => {
  const env = setup();
  await env.transaction.publish(candidate, { bootstrap: true });
  const journal = await env.transaction.read(env.transaction.journalKey);
  journal.phase = "prepared";
  delete journal.receipt;
  await env.transaction.write(env.transaction.journalKey, journal);
  env.setLive("unrelated-version");
  let rolledBack = false;
  env.serving.rollback = async () => {
    rolledBack = true;
  };
  await assert.rejects(env.transaction.reconcile(), /operator reconciliation/);
  assert.equal(rolledBack, false);
  assert.equal(env.live(), "unrelated-version");
});

test("lost deployment responses are rolled back only with proven candidate correlation", async () => {
  for (const matching of [false, true]) {
    const env = setup();
    env.serving.deploy = async () => {
      env.setLive("orphan-version");
      throw new Error("response lost");
    };
    env.serving.matchesCandidate = async (input, identity) =>
      input.artifact === candidate.artifact &&
      identity === "orphan-version" &&
      matching;
    await assert.rejects(
      env.transaction.publish(candidate, { bootstrap: true }),
      matching ? /restored and verified/ : /rollback is unverified/,
    );
    assert.equal(env.live(), matching ? "prior-version" : "orphan-version");
  }
});

test("lost preview rollback responses can recover a proven prior artifact with its actual new identity", async () => {
  const env = setup();
  const first = await env.transaction.publish(candidate, { bootstrap: true });
  env.failVerification();
  env.serving.rollback = async () => {
    env.setLive("restored-preview");
    throw new Error("rollback response lost");
  };
  await assert.rejects(
    env.transaction.publish({ ...candidate, digest: "f".repeat(64) }),
    /rollback is unverified/,
  );
  env.serving.recoverReceipt = async (receipt, identity) =>
    identity === "restored-preview"
      ? { ...receipt, deployment: identity }
      : undefined;
  await new PublicationTransaction(
    env.store,
    env.serving,
    "staging",
  ).reconcile();
  const accepted = await env.transaction.read(env.transaction.currentKey);
  assert.equal(accepted.receipt.deployment, "restored-preview");
  assert.equal(accepted.digest, first.accepted.digest);
});

test("rollback with different artifact proof remains an incident", async () => {
  const env = setup();
  env.failVerification();
  env.serving.rollback = async (_identity, receipt) => {
    env.setLive("restored-preview");
    return { ...receipt, artifact: "0".repeat(64), deployment: env.live() };
  };
  await assert.rejects(
    env.transaction.publish(candidate, { bootstrap: true }),
    /rollback is unverified/,
  );
  assert.equal(
    await env.transaction.read(env.transaction.currentKey),
    undefined,
  );
});
