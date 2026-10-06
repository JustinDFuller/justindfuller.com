import { archiveChecksum } from "./obsidian-archive.mjs";
import { validateDeploymentArchive } from "./obsidian-cloudflare.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";

const identityPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const archiveLimit = 256 * 1024 * 1024;

function exactBytes(value, expected) {
  return (
    value !== undefined &&
    Buffer.from(value).length === expected.length &&
    Buffer.from(value).equals(expected) &&
    archiveChecksum(value) === archiveChecksum(expected)
  );
}

export async function captureBootstrapReceipt({
  store,
  serving,
  mode,
  pr,
  archive,
  checksum,
}) {
  const namespace = targetNamespace(mode, pr);
  if (
    !store ||
    typeof store.get !== "function" ||
    typeof store.put !== "function" ||
    !serving ||
    !/^[a-f0-9]{32}$/.test(serving.account ?? "") ||
    serving.mode !== mode ||
    serving.pr !== pr ||
    typeof serving.identity !== "function" ||
    typeof serving.verify !== "function"
  )
    throw new Error("Bootstrap capture target is invalid");
  const account = serving.account;
  if (
    !Buffer.isBuffer(archive) ||
    archive.length < 1 ||
    archive.length > archiveLimit ||
    !/^[a-f0-9]{64}$/.test(checksum ?? "") ||
    archiveChecksum(archive) !== checksum
  )
    throw new Error("Bootstrap archive checksum differs");
  const bytes = Buffer.from(archive);
  try {
    validateDeploymentArchive(bytes, checksum, {
      account,
      mode,
    });
  } catch {
    throw new Error("Bootstrap archive target is invalid");
  }
  const identity = await serving.identity();
  if (!identityPattern.test(identity ?? ""))
    throw new Error("Current serving identity is invalid");
  const key = `rollback/artifacts/${namespace}/${checksum}.tar`;
  let prior;
  try {
    prior = await store.get(key, archiveLimit);
  } catch {
    throw new Error("Bootstrap archive storage is unavailable");
  }
  if (prior && !exactBytes(prior, bytes))
    throw new Error("Immutable bootstrap archive already differs");
  let writeFailed = false;
  if (!prior) {
    try {
      await store.put(key, bytes, true);
    } catch {
      writeFailed = true;
    }
  }
  let retained;
  try {
    retained = await store.get(key, archiveLimit);
  } catch {
    throw new Error("Bootstrap archive readback is unavailable");
  }
  if (!exactBytes(retained, bytes))
    throw new Error(
      writeFailed
        ? "Bootstrap archive write could not be confirmed"
        : "Bootstrap archive readback differs",
    );
  const receipt = {
    deployment: identity,
    artifact: checksum,
    archive: key,
    verification: {},
  };
  try {
    await serving.verify(receipt);
  } catch {
    throw new Error("Current serving artifact verification failed");
  }
  let verifiedIdentity;
  try {
    verifiedIdentity = await serving.identity();
  } catch {
    throw new Error(
      "Current serving identity is unavailable after verification",
    );
  }
  if (
    verifiedIdentity !== identity ||
    serving.account !== account ||
    serving.mode !== mode ||
    serving.pr !== pr
  )
    throw new Error(
      "Current serving identity or target changed during bootstrap capture",
    );
  return receipt;
}
