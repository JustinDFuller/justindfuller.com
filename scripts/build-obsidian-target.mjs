import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  downloadPreparationBundle,
  uploadPreparationBundle,
} from "./obsidian-pipeline.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";
import {
  createPublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";
import { validateDeploymentArchive } from "./obsidian-cloudflare.mjs";
import { archiveTransfer } from "./obsidian-private-storage.mjs";

export function testedArtifactKey(mode, pr, run, checksum) {
  const namespace = targetNamespace(mode, pr);
  if (
    namespace === "local" ||
    !/^[1-9][0-9]*(?:-[1-9][0-9]*)?$/.test(run ?? "") ||
    !/^[a-f0-9]{64}$/.test(checksum ?? "")
  )
    throw new Error("Exact tested artifact identity required");
  return `artifacts/${namespace}/${run}/${checksum}.tar`;
}

export function validateBuiltArtifact(
  bytes,
  checksum,
  { account, mode, publication },
) {
  const entries = validateDeploymentArchive(bytes, checksum, { account, mode }),
    files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.name, entry.bytes]),
    ),
    marker = Buffer.from(JSON.stringify({ version: 1, publication }));
  if (!/^[a-f0-9]{64}$/.test(publication ?? ""))
    throw new Error("Exact artifact publication marker required");
  for (const path of [
    "dist/__publication.json",
    ".cloudflare/output/v0/workers/default/assets/__publication.json",
  ])
    if (!files.get(path)?.equals(marker))
      throw new Error("Tested artifact marker differs");
  for (const [path, body] of files)
    if (
      path.startsWith("dist/") &&
      !["dist/_headers", "dist/_redirects"].includes(path) &&
      !files
        .get(`.cloudflare/output/v0/workers/default/assets/${path.slice(5)}`)
        ?.equals(body)
    )
      throw new Error("Tested Worker assets differ from rendered output");
  const assetRoot = ".cloudflare/output/v0/workers/default/assets/";
  for (const [path, body] of files)
    if (
      path.startsWith(assetRoot) &&
      !files.get(`dist/${path.slice(assetRoot.length)}`)?.equals(body)
    )
      throw new Error("Worker artifact contains an unrendered asset");
  const worker = JSON.parse(
    files
      .get(".cloudflare/output/v0/workers/default/worker.config.json")
      .toString("utf8"),
  );
  if (
    mode !== "production" &&
    (JSON.stringify(Object.keys(worker.env ?? {}).sort()) !==
      JSON.stringify(["ASSETS", "OBSIDIAN_SOURCE"]) ||
      JSON.stringify(worker.env.ASSETS) !==
        JSON.stringify({ type: "assets" }) ||
      worker.env.OBSIDIAN_SOURCE?.type !== "r2" ||
      worker.env.OBSIDIAN_SOURCE.name !== "justindfuller-obsidian-source" ||
      Object.keys(worker.env.OBSIDIAN_SOURCE).length !== 2)
  )
    throw new Error("Private artifact runtime binding boundary differs");
  const manifest = JSON.parse(
    files.get(".cloudflare/site-manifest.json").toString("utf8"),
  );
  if (
    !Array.isArray(manifest.pages) ||
    !Array.isArray(manifest.assets) ||
    (mode === "production" && (manifest.privateImages?.length ?? 0))
  )
    throw new Error("Tested artifact manifest boundary differs");
  return {
    path: "/__publication.json",
    size: marker.length,
    sha256: archiveChecksum(marker),
  };
}

export async function buildPublicationTarget({
  store,
  mode,
  pr,
  run,
  codeSha,
  preparation,
  account = "9dce34804a27754a4ea66a5789827dfa",
  cwd = process.cwd(),
  execute = runPublicationCommand,
}) {
  const target = { mode, pr, run, codeSha },
    namespace = targetNamespace(mode, pr);
  testedArtifactKey(mode, pr, run, preparation);
  const checkout = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (checkout.stdout.trim() !== codeSha)
    throw new Error("Build checkout differs from prepared code");
  const bundle = await downloadPreparationBundle(store, preparation, target),
    overlay = `.obsidian-publish/hosted/${namespace}/build-prepared.json`,
    publication = archiveChecksum(
      Buffer.from(
        JSON.stringify({
          version: 1,
          target: namespace,
          run,
          codeSha,
          source: bundle.candidate.source,
          digest: bundle.candidate.digest,
        }),
      ),
    );
  await saveProtectedReport(
    overlay,
    bundle.candidate.verification.prepared,
    cwd,
  );
  await execute(
    "npm",
    [
      "run",
      "build:cloudflare",
      "--",
      "--mode",
      mode,
      "--overlay",
      overlay,
      "--publication-id",
      publication,
    ],
    { cwd, purpose: "build" },
  );
  if (mode !== "preview")
    await execute(
      "npx",
      ["cf", "deploy", "--prebuilt", "--mode", mode, "--dry-run"],
      { cwd, purpose: "build" },
    );
  const after = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (after.stdout.trim() !== codeSha)
    throw new Error("Build code changed before artifact handoff");
  const bytes = createPublicationArchive(cwd),
    checksum = archiveChecksum(bytes),
    marker = validateBuiltArtifact(bytes, checksum, {
      account,
      mode,
      publication,
    }),
    key = testedArtifactKey(mode, pr, run, checksum);
  await archiveTransfer(store, "upload", key, bytes, checksum);
  const candidate = {
      ...bundle.candidate,
      artifact: checksum,
      archive: `rollback/artifacts/${namespace}/${checksum}.tar`,
      verification: { ...bundle.candidate.verification, marker },
    },
    tested = {
      ...bundle,
      candidate,
      testedArtifact: { key, checksum, bytes: bytes.length },
    },
    handoff = await uploadPreparationBundle(store, tested, target);
  return {
    version: 1,
    status: "built",
    target: namespace,
    run,
    codeSha,
    source: candidate.source,
    digest: candidate.digest,
    artifact: checksum,
    archiveBytes: bytes.length,
    handoff,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      run: { type: "string" },
      "code-sha": { type: "string" },
      preparation: { type: "string" },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    },
  });
  const { environmentTransport, PrivateR2Store, r2Target } =
      await import("../tools/obsidian-image-publisher/src/publication.ts"),
    transport = environmentTransport("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
      transport,
      r2Target(values.account, "justindfuller-obsidian-state"),
    );
    console.log(
      JSON.stringify(
        await buildPublicationTarget({
          store,
          mode: values.mode,
          pr: values.pr ? Number(values.pr) : undefined,
          run: values.run,
          codeSha: values["code-sha"],
          preparation: values.preparation,
          account: values.account,
        }),
      ),
    );
  } finally {
    transport.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Private artifact build failed; publication was not deployed",
    );
    process.exitCode = 1;
  });
