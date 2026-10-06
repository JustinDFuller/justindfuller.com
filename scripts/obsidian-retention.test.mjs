import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planObsidianRetention,
  prunePublicationArchives,
} from "./obsidian-retention.mjs";

const namespace = "production";
const hash = (digit) => digit.repeat(64);
const key = (digit, target = namespace) =>
  `rollback/artifacts/${target}/${hash(digit)}.tar`;
const time = (daysAgo) =>
  new Date(Date.UTC(2026, 9, 6) - daysAgo * 86400000).toISOString();
const acceptedState = (digit = "a") => ({
  version: 1,
  namespace,
  artifact: hash(digit),
  archive: key(digit),
  receipt: { artifact: hash(digit), archive: key(digit) },
});
const journalState = ({
  prior = "b",
  candidate = "c",
  phase = "promoted",
} = {}) => ({
  version: 1,
  namespace,
  phase,
  candidate: { artifact: hash(candidate), archive: key(candidate) },
  prior: { receipt: { artifact: hash(prior), archive: key(prior) } },
  receipt: { artifact: hash(candidate), archive: key(candidate) },
});
const meta = (digit, daysAgo, size = 10, target = namespace) => ({
  key: key(digit, target),
  lastModified: time(daysAgo),
  size,
});

test("keeps active and journal archives even when old, and caps only unreferenced archives", () => {
  const metadata = [
    meta("a", 90, 11),
    meta("b", 100, 12),
    meta("c", 80, 13),
    meta("d", 1, 14),
    meta("e", 2, 15),
    meta("f", 3, 16),
    meta("0", 4, 17),
  ];
  const plan = planObsidianRetention({
    metadata,
    accepted: acceptedState(),
    journal: journalState(),
    namespace,
    now: Date.parse(time(0)),
  });
  assert.deepEqual(plan.deleteKeys, [key("0")]);
  assert.deepEqual(plan.summary, {
    listed: 7,
    referenced: 3,
    retainedUnreferenced: 3,
    deleteCount: 1,
    deleteBytes: 17,
  });
});

test("age cap removes old unreferenced archives but retains old referenced rollback", () => {
  const plan = planObsidianRetention({
    metadata: [meta("a", 40, 3), meta("b", 15, 5), meta("d", 15, 7)],
    accepted: acceptedState(),
    journal: journalState(),
    namespace,
    now: Date.parse(time(0)),
  });
  assert.deepEqual(plan.deleteKeys, [key("d")]);
  assert.equal(plan.summary.deleteBytes, 7);
});

test("references and inventory are isolated to the requested target", () => {
  const plan = planObsidianRetention({
    metadata: [meta("a", 50), meta("f", 1), meta("0", 100, 9, "staging")],
    accepted: acceptedState(),
    journal: journalState(),
    namespace,
    now: Date.parse(time(0)),
  });
  assert.deepEqual(plan.deleteKeys, []);
  assert.equal(plan.summary.listed, 2);
});

test("invalid state, metadata, and conflicting duplicates fail closed", () => {
  const base = {
    metadata: [meta("a", 1)],
    accepted: acceptedState(),
    journal: journalState(),
    namespace,
    now: Date.parse(time(0)),
  };
  for (const change of [
    { accepted: undefined },
    { accepted: { ...acceptedState(), namespace: "staging" } },
    { journal: { ...journalState(), candidate: undefined } },
    { metadata: [{ ...meta("a", 1), size: -1 }] },
    { metadata: [meta("a", 1), meta("a", 2)] },
  ])
    assert.throws(() => planObsidianRetention({ ...base, ...change }));
});

function storeFixture() {
  const values = new Map([
    [
      `accepted/${namespace}/current.json`,
      Buffer.from(JSON.stringify(acceptedState())),
    ],
    [
      `journals/${namespace}/pending.json`,
      Buffer.from(JSON.stringify(journalState())),
    ],
  ]);
  const deleted = [];
  return {
    values,
    deleted,
    get: async (stateKey) => {
      return values.get(stateKey);
    },
    listArchives: async () => [
      meta("a", 1),
      meta("b", 1),
      meta("c", 1),
      meta("d", 1),
      meta("e", 2),
      meta("f", 3),
      meta("0", 4),
    ],
    deleteArchive: async (archiveKey) => deleted.push(archiveKey),
  };
}

test("prune defaults to dry run and deletes only planned keys when applied", async () => {
  const dryStore = storeFixture();
  const dryRun = await prunePublicationArchives(dryStore, namespace, {
    now: Date.parse(time(0)),
  });
  assert.equal(dryRun.deleteKeys.length, 1);
  assert.deepEqual(dryStore.deleted, []);

  const liveStore = storeFixture();
  const applied = await prunePublicationArchives(liveStore, namespace, {
    apply: true,
    now: Date.parse(time(0)),
  });
  assert.deepEqual(liveStore.deleted, applied.deleteKeys);
  assert.deepEqual(liveStore.deleted, [key("0")]);
});

test("state change before cleanup aborts without deleting", async () => {
  const store = storeFixture();
  let calls = 0;
  const original = store.get;
  store.get = async (stateKey, limit) => {
    calls += 1;
    if (calls === 5)
      store.values.set(
        stateKey,
        Buffer.from(JSON.stringify(acceptedState("e"))),
      );
    const value = await original(stateKey, limit);
    return value;
  };
  await assert.rejects(
    prunePublicationArchives(store, namespace, {
      apply: true,
      now: Date.parse(time(0)),
    }),
    /state changed/,
  );
  assert.deepEqual(store.deleted, []);
});
