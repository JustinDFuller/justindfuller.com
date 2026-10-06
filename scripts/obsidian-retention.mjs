const namespacePattern = /^(?:production|staging|local|pr\/[1-9][0-9]*)$/;
const hashPattern = /^[a-f0-9]{64}$/;
const day = 24 * 60 * 60 * 1000;

function stateEnvelope(value, namespace, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    value.namespace !== namespace
  )
    throw new Error(`Invalid ${label} envelope`);
  return value;
}

function archiveReference(value, namespace) {
  if (typeof value !== "string") throw new Error("Invalid archive reference");
  const prefix = `rollback/artifacts/${namespace}/`;
  if (!value.startsWith(prefix))
    throw new Error("Archive reference target mismatch");
  const hash = value.slice(prefix.length, -4);
  if (`${prefix}${hash}.tar` !== value || !hashPattern.test(hash))
    throw new Error("Invalid archive reference");
  return value;
}

function addArchiveReference(set, value, namespace) {
  if (value !== undefined) {
    const key = archiveReference(value, namespace);
    if (key) set.add(key);
  }
}

function addReceipt(set, receipt, namespace) {
  if (receipt === undefined) return;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt))
    throw new Error("Invalid receipt");
  if (
    typeof receipt.artifact !== "string" ||
    !hashPattern.test(receipt.artifact)
  )
    throw new Error("Invalid receipt artifact");
  const key = archiveReference(receipt.archive, namespace);
  if (key && receipt.artifact !== key.slice(key.lastIndexOf("/") + 1, -4))
    throw new Error("Receipt artifact does not match its archive");
  if (key) set.add(key);
}

function targetReferences(envelope, namespace, label) {
  if (envelope === undefined || envelope === null) return new Set();
  stateEnvelope(envelope, namespace, label);
  const references = new Set();
  if (label === "accepted") {
    if (
      typeof envelope.artifact !== "string" ||
      !hashPattern.test(envelope.artifact)
    )
      throw new Error("Invalid accepted artifact");
    const key = archiveReference(envelope.archive, namespace);
    if (envelope.artifact !== key.slice(key.lastIndexOf("/") + 1, -4))
      throw new Error("Accepted artifact does not match its archive");
    references.add(key);
    if (envelope.receipt === undefined)
      throw new Error("Invalid accepted receipt");
  }
  addReceipt(references, envelope.receipt, namespace);
  if (label === "journal") {
    if (
      typeof envelope.phase !== "string" ||
      !envelope.candidate ||
      typeof envelope.candidate !== "object" ||
      !envelope.prior ||
      typeof envelope.prior !== "object" ||
      !envelope.prior.receipt ||
      typeof envelope.prior.receipt !== "object"
    )
      throw new Error("Invalid journal references");
    if (
      !envelope.candidate ||
      typeof envelope.candidate.artifact !== "string" ||
      !hashPattern.test(envelope.candidate.artifact)
    )
      throw new Error("Invalid journal candidate");
    const candidateKey = archiveReference(
      envelope.candidate.archive,
      namespace,
    );
    if (
      candidateKey &&
      envelope.candidate.artifact !==
        candidateKey.slice(candidateKey.lastIndexOf("/") + 1, -4)
    )
      throw new Error("Journal candidate artifact does not match its archive");
    if (candidateKey) references.add(candidateKey);
    addReceipt(references, envelope.prior.receipt, namespace);
    addReceipt(references, envelope.receipt, namespace);
  }
  return references;
}

const stateKeys = (namespace) => ({
  accepted: `accepted/${namespace}/current.json`,
  journal: `journals/${namespace}/pending.json`,
});

function stateValue(bytes, label) {
  if (!bytes) throw new Error(`Missing ${label} state`);
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new Error(`Malformed ${label} state`);
  }
}

async function stateSnapshot(store, keys) {
  const [accepted, journal] = await Promise.all([
    store.get(keys.accepted, 64 * 1024 * 1024),
    store.get(keys.journal, 64 * 1024 * 1024),
  ]);
  return {
    accepted: accepted && Buffer.from(accepted),
    journal: journal && Buffer.from(journal),
  };
}

function sameSnapshot(a, b) {
  return Boolean(
    a.accepted &&
    a.journal &&
    b.accepted &&
    b.journal &&
    a.accepted.equals(b.accepted) &&
    a.journal.equals(b.journal),
  );
}

export async function prunePublicationArchives(
  store,
  namespace,
  { apply = false, now = Date.now() } = {},
) {
  if (typeof namespace !== "string" || !namespacePattern.test(namespace))
    throw new Error("Invalid state namespace");
  if (
    typeof store?.listArchives !== "function" ||
    typeof store?.get !== "function"
  )
    throw new Error("Archive store does not support retention planning");
  const keys = stateKeys(namespace);
  const snapshot = await stateSnapshot(store, keys);
  const accepted = stateValue(snapshot.accepted, "accepted");
  const journal = stateValue(snapshot.journal, "journal");
  const metadata = await store.listArchives(namespace);
  const plan = planObsidianRetention({
    metadata,
    accepted,
    journal,
    namespace,
    now,
  });
  if (!apply || plan.deleteKeys.length === 0) return plan;
  if (typeof store.deleteArchive !== "function")
    throw new Error("Archive store does not support deletion");
  if (!sameSnapshot(snapshot, await stateSnapshot(store, keys)))
    throw new Error("Publication state changed before archive cleanup");
  for (const key of plan.deleteKeys) {
    if (!sameSnapshot(snapshot, await stateSnapshot(store, keys)))
      throw new Error("Publication state changed during archive cleanup");
    await store.deleteArchive(key);
  }
  return plan;
}

export function planObsidianRetention({
  metadata,
  accepted,
  journal,
  namespace,
  now = Date.now(),
}) {
  if (typeof namespace !== "string" || !namespacePattern.test(namespace))
    throw new Error("Invalid state namespace");
  if (!Number.isFinite(now)) throw new Error("Invalid retention time");
  if (!Array.isArray(metadata)) throw new Error("Invalid artifact listing");

  const protectedKeys = new Set([
    ...targetReferences(accepted, namespace, "accepted"),
    ...targetReferences(journal, namespace, "journal"),
  ]);
  if (
    accepted === undefined ||
    accepted === null ||
    journal === undefined ||
    journal === null
  )
    throw new Error("Accepted state and journal are required");

  const prefix = `rollback/artifacts/${namespace}/`;
  const inventory = new Map();
  for (const item of metadata) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.key !== "string" ||
      !Number.isSafeInteger(item.size) ||
      item.size < 0 ||
      typeof item.lastModified !== "string" ||
      !Number.isFinite(Date.parse(item.lastModified))
    )
      throw new Error("Invalid artifact metadata");
    if (!item.key.startsWith(prefix)) continue;
    const hash = item.key.slice(prefix.length, -4);
    if (`${prefix}${hash}.tar` !== item.key || !hashPattern.test(hash))
      continue;
    const record = {
      key: item.key,
      size: item.size,
      modified: Date.parse(item.lastModified),
    };
    const previous = inventory.get(item.key);
    if (
      previous &&
      (previous.size !== record.size || previous.modified !== record.modified)
    )
      throw new Error("Conflicting duplicate artifact metadata");
    inventory.set(item.key, record);
  }

  const unreferenced = [...inventory.values()]
    .filter((item) => !protectedKeys.has(item.key))
    .sort((a, b) => b.modified - a.modified || a.key.localeCompare(b.key));
  const keepRecent = new Set(unreferenced.slice(0, 3).map((item) => item.key));
  const deleteKeys = unreferenced
    .filter(
      (item) => now - item.modified > 14 * day || !keepRecent.has(item.key),
    )
    .map((item) => item.key);
  const deletedBytes = deleteKeys.reduce(
    (total, key) => total + inventory.get(key).size,
    0,
  );
  return {
    deleteKeys,
    summary: {
      listed: inventory.size,
      referenced: [...protectedKeys].filter((key) => inventory.has(key)).length,
      retainedUnreferenced: unreferenced.length - deleteKeys.length,
      deleteCount: deleteKeys.length,
      deleteBytes: deletedBytes,
    },
  };
}
