import { createHash } from "node:crypto";
import {
  prepareHostedTarget,
  readPrivatePreparation,
  preparationCode,
} from "./prepare-obsidian-target.mjs";
import { promotePreparedImages } from "./promote-obsidian-images.mjs";
import { recordPublication } from "./record-obsidian-publication.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";

const hash = /^[a-f0-9]{64}$/;
const maxBundleBytes = 64 * 1024 * 1024;
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function preparationBundleKey(mode, pr, run, digest) {
  const namespace = targetNamespace(mode, pr);
  if (
    namespace === "local" ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run) ||
    !hash.test(digest ?? "")
  )
    throw new Error("Exact private preparation handoff required");
  return `candidates/${namespace}/${run}/${digest}.json`;
}

export function validatePreparationBundle(bundle, { mode, pr, run, codeSha }) {
  const namespace = targetNamespace(mode, pr),
    candidate = bundle?.candidate,
    prepared = candidate?.verification?.prepared,
    diagnostics = bundle?.diagnostics;
  if (
    namespace === "local" ||
    bundle?.version !== 1 ||
    bundle.target !== namespace ||
    bundle.run !== run ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run ?? "") ||
    !/^[a-f0-9]{40}$/.test(codeSha ?? "") ||
    bundle.codeSha !== codeSha ||
    candidate?.codeSha !== codeSha ||
    candidate.code !== preparationCode(codeSha, mode) ||
    !hash.test(candidate.source ?? "") ||
    !hash.test(candidate.digest ?? "") ||
    prepared?.version !== 1 ||
    prepared.mode !== mode ||
    prepared.revision !== candidate.source ||
    prepared.digest !== candidate.digest ||
    prepared.state?.version !== 1 ||
    prepared.state.mode !== mode ||
    prepared.state.revision !== candidate.source ||
    JSON.stringify(prepared.state) !== JSON.stringify(candidate.state) ||
    !Array.isArray(prepared.entries) ||
    !prepared.images ||
    typeof prepared.images !== "object" ||
    Array.isArray(prepared.images) ||
    diagnostics?.version !== 1 ||
    diagnostics.mode !== mode ||
    diagnostics.source !== candidate.source ||
    diagnostics.digest !== candidate.digest ||
    !Array.isArray(diagnostics.files) ||
    !Array.isArray(diagnostics.issues)
  )
    throw new Error("Private preparation handoff correlation differs");
  return bundle;
}

export async function uploadPreparationBundle(store, bundle, target) {
  validatePreparationBundle(bundle, target);
  const bytes = Buffer.from(JSON.stringify(bundle));
  if (bytes.length > maxBundleBytes)
    throw new Error("Private preparation handoff exceeds limit");
  const digest = checksum(bytes),
    key = preparationBundleKey(target.mode, target.pr, target.run, digest),
    prior = await store.get(key, maxBundleBytes);
  if (prior && !Buffer.from(prior).equals(bytes))
    throw new Error("Immutable preparation handoff differs");
  if (!prior) await store.put(key, bytes, true);
  const verified = await downloadPreparationBundle(store, digest, target);
  if (JSON.stringify(verified) !== JSON.stringify(bundle))
    throw new Error("Private preparation handoff readback differs");
  return { key, checksum: digest, bytes: bytes.length };
}

export async function downloadPreparationBundle(store, digest, target) {
  const key = preparationBundleKey(target.mode, target.pr, target.run, digest),
    raw = await store.get(key, maxBundleBytes);
  if (!raw || raw.byteLength > maxBundleBytes || checksum(raw) !== digest)
    throw new Error("Private preparation handoff checksum differs");
  return validatePreparationBundle(
    JSON.parse(Buffer.from(raw).toString("utf8")),
    target,
  );
}

export async function preparePublicationTarget(options) {
  const {
      store,
      serving,
      mode,
      pr,
      bootstrap = false,
      run,
      cwd = process.cwd(),
      execute = runPublicationCommand,
      promote,
    } = options,
    namespace = targetNamespace(mode, pr);
  preparationBundleKey(mode, pr, run, "0".repeat(64));
  const initial = await prepareHostedTarget({ ...options, cwd, execute });
  if (initial.decision === "retain-serving") return initial;
  const directory = `.obsidian-publish/hosted/${namespace}`,
    file = (name) => `${directory}/${name}.json`;
  let promotion;
  if (mode === "production") {
    promotion = await promotePreparedImages({
      overlay: file("prepared"),
      source: initial.sourceAvailable ? file("pinned") : undefined,
      acceptedOnly: !initial.sourceAvailable,
      out: file("promotion"),
      unavailableOut: file("unavailable"),
      cwd,
      execute,
      promote,
    });
    await execute(
      "go",
      [
        "run",
        "./cmd/prepare-obsidian",
        "--mode",
        mode,
        "--out",
        file("prepared"),
        "--report-out",
        file("diagnostics"),
        ...(bootstrap ? ["--bootstrap"] : ["--state", file("state")]),
        ...(initial.sourceAvailable
          ? ["--source", file("pinned")]
          : ["--accepted-only", "--unavailable-images", file("unavailable")]),
      ],
      { cwd, purpose: "build" },
    );
  }
  const prepared = await readPrivatePreparation(file("prepared"), cwd),
    diagnostics = await readPrivatePreparation(file("diagnostics"), cwd),
    codeSha = (
      await execute("git", ["rev-parse", "HEAD"], { cwd, purpose: "build" })
    ).stdout.trim();
  if (
    codeSha !== initial.codeSha ||
    prepared.revision !== initial.source ||
    (!initial.sourceAvailable &&
      !diagnostics.issues?.some(
        (issue) => issue.category === "source_degraded",
      ))
  )
    throw new Error("Preparation changed code or source identity");
  const candidate = {
      source: prepared.revision,
      code: preparationCode(codeSha, mode),
      codeSha,
      digest: prepared.digest,
      state: prepared.state,
      verification: { prepared },
    },
    target = { mode, pr, run, codeSha },
    bundle = {
      version: 1,
      target: namespace,
      run,
      codeSha,
      candidate,
      diagnostics,
    };
  validatePreparationBundle(bundle, target);
  await saveProtectedReport(file("candidate"), candidate, cwd);
  const receipt = bootstrap
    ? undefined
    : await recordPublication(candidate, diagnostics, {
        store,
        serving,
        namespace,
        unchangedOnly: true,
      });
  if (receipt && receipt.status !== "build-required")
    return {
      ...initial,
      status: "verified",
      decision: "skip-build",
      digest: candidate.digest,
      posts: prepared.entries.length,
      images: Object.keys(prepared.images).length,
      issues: diagnostics.issues.length,
      receipt,
      promotion,
    };
  const handoff = await uploadPreparationBundle(store, bundle, target);
  return {
    ...initial,
    status: "prepared",
    decision: "build-required",
    digest: candidate.digest,
    posts: prepared.entries.length,
    images: Object.keys(prepared.images).length,
    issues: diagnostics.issues.length,
    handoff,
    promotion,
  };
}
