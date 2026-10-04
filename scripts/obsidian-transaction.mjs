import { createHash } from "node:crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const encoded = (value) => Buffer.from(JSON.stringify(value));
const validIdentity = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);

export function targetNamespace(target, pr) {
  if (["production", "staging", "local"].includes(target) && pr === undefined)
    return target;
  if (target === "preview" && Number.isSafeInteger(pr) && pr > 0)
    return `pr/${pr}`;
  throw new Error("Invalid publication target");
}

export class PublicationTransaction {
  constructor(store, serving, namespace) {
    if (!/^(production|staging|local|pr\/[1-9][0-9]*)$/.test(namespace))
      throw new Error("Invalid state namespace");
    this.store = store;
    this.serving = serving;
    this.namespace = namespace;
    this.currentKey = `accepted/${namespace}/current.json`;
    this.journalKey = `journals/${namespace}/pending.json`;
  }

  async read(key) {
    const bytes = await this.store.get(key, 64 * 1024 * 1024);
    if (!bytes) return undefined;
    const value = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (value.version !== 1 || value.namespace !== this.namespace)
      throw new Error("Private state envelope mismatch");
    return value;
  }

  async write(key, value) {
    const bytes = encoded(value);
    await this.store.put(key, bytes);
    const actual = await this.store.get(key, 64 * 1024 * 1024);
    if (!actual || !Buffer.from(actual).equals(bytes))
      throw new Error("Private state write is unverified");
  }

  async promote(journal) {
    if (
      journal.phase !== "verified" ||
      !journal.receipt ||
      (await this.serving.identity()) !== journal.receipt.deployment
    )
      throw new Error("Verified deployment identity changed before promotion");
    const accepted = {
      version: 1,
      namespace: this.namespace,
      ...journal.candidate,
      receipt: journal.receipt,
    };
    await this.write(this.currentKey, accepted);
    journal.phase = "promoted";
    await this.write(this.journalKey, journal);
    return accepted;
  }

  async reconcile() {
    const journal = await this.read(this.journalKey);
    if (!journal || ["promoted", "rolled_back"].includes(journal.phase)) return;
    const live = await this.serving.identity();
    const accepted = await this.read(this.currentKey);
    if (
      accepted?.receipt?.deployment === live &&
      journal.phase === "verified" &&
      accepted.receipt.artifact === journal.candidate.artifact
    ) {
      await this.serving.verify(accepted.receipt);
      journal.phase = "promoted";
      await this.write(this.journalKey, journal);
      return;
    }
    if (journal.phase === "verified" && journal.receipt?.deployment === live) {
      await this.serving.verify(journal.receipt);
      await this.promote(journal);
      return;
    }
    if (live !== journal.prior.identity)
      await this.serving.rollback(journal.prior.identity);
    if ((await this.serving.identity()) !== journal.prior.identity)
      throw new Error(
        "Interrupted publication rollback identity is unverified",
      );
    await this.serving.verify(journal.prior.receipt);
    journal.phase = "rolled_back";
    await this.write(this.journalKey, journal);
  }

  async publish(candidate, { bootstrap = false } = {}) {
    for (const key of ["source", "code", "digest", "artifact"])
      if (!/^[a-f0-9]{64}$/.test(candidate[key] ?? ""))
        throw new Error("Invalid candidate fingerprint");
    if (!candidate.state || !candidate.archive || !candidate.verification)
      throw new Error(
        "Candidate requires state and private artifact verification",
      );
    await this.reconcile();
    const previous = await this.read(this.currentKey);
    const identity = await this.serving.identity();
    if (!validIdentity(identity))
      throw new Error("Serving identity cannot be captured");
    if (
      (!previous && !bootstrap) ||
      (previous && previous.receipt?.deployment !== identity)
    )
      throw new Error("Accepted state and serving identity differ");
    if (
      previous?.code === candidate.code &&
      previous.digest === candidate.digest
    ) {
      await this.serving.verify(previous.receipt);
      const accepted = {
        version: 1,
        namespace: this.namespace,
        ...candidate,
        artifact: previous.artifact,
        archive: previous.archive,
        verification: previous.verification,
        receipt: previous.receipt,
      };
      await this.write(this.currentKey, accepted);
      return { accepted, skipped: true };
    }
    const priorReceipt =
      previous?.receipt ?? (await this.serving.capture(identity));
    const journal = {
      version: 1,
      namespace: this.namespace,
      phase: "prepared",
      candidate,
      prior: { identity, receipt: priorReceipt },
    };
    await this.write(
      `candidates/${this.namespace}/${sha256(encoded(candidate))}.json`,
      { version: 1, namespace: this.namespace, ...candidate },
    );
    await this.write(this.journalKey, journal);
    try {
      const deployment = await this.serving.deploy(candidate);
      if (!validIdentity(deployment))
        throw new Error("Deployment identity unavailable");
      journal.phase = "deployed";
      journal.receipt = {
        deployment,
        artifact: candidate.artifact,
        archive: candidate.archive,
        verification: candidate.verification,
      };
      await this.write(this.journalKey, journal);
      await this.serving.verify(journal.receipt);
      if ((await this.serving.identity()) !== deployment)
        throw new Error("Serving identity changed during verification");
      journal.phase = "verified";
      await this.write(this.journalKey, journal);
    } catch {
      try {
        if ((await this.serving.identity()) !== identity)
          await this.serving.rollback(identity);
        if ((await this.serving.identity()) !== identity)
          throw new Error("Rollback identity mismatch");
        await this.serving.verify(priorReceipt);
        journal.phase = "rolled_back";
        await this.write(this.journalKey, journal);
      } catch {
        journal.phase = "incident";
        await this.write(this.journalKey, journal).catch(() => {});
        throw new Error(
          "Publication failed and rollback is unverified; operator reconciliation required",
        );
      }
      throw new Error(
        "Publication failed; prior deployment restored and verified",
      );
    }
    const accepted = await this.promote(journal);
    return { accepted, skipped: false };
  }
}
