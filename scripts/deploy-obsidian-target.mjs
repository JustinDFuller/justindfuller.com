import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { downloadPreparationBundle } from "./obsidian-pipeline.mjs";
import {
  artifactPublication,
  testedArtifactKey,
  validateBuiltArtifact,
} from "./build-obsidian-target.mjs";
import { archiveTransfer } from "./obsidian-private-storage.mjs";
import { archiveChecksum } from "./obsidian-archive.mjs";
import { recordPublication } from "./record-obsidian-publication.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import { currentPreview } from "./obsidian-workflow.mjs";
import { publicationGitHub } from "./plan-obsidian-workflow.mjs";
import { CloudflareServing } from "./obsidian-cloudflare.mjs";
import { readPrivatePreparation } from "./prepare-obsidian-target.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";
import {
  compilePrivateWorker,
  validatePrivateWorkerArchive,
} from "./obsidian-worker.mjs";

export async function deployPublicationTarget({
  store,
  serving,
  mode,
  pr,
  run,
  codeSha,
  preparation,
  account = "9dce34804a27754a4ea66a5789827dfa",
  cwd = process.cwd(),
  execute = runPublicationCommand,
  github,
  bootstrap = false,
  record = recordPublication,
  controlWorkspace,
}) {
  const namespace = targetNamespace(mode, pr);
  testedArtifactKey(mode, pr, run, preparation);
  if (mode === "preview" && typeof github?.pull !== "function")
    throw new Error("Current preview admission required");
  if (serving.mode !== mode || serving.account !== account || serving.pr !== pr)
    throw new Error("Serving authority differs from the tested target");
  const checkout = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (checkout.stdout.trim() !== codeSha)
    throw new Error("Deployment checkout differs from tested code");
  const bundle = await downloadPreparationBundle(store, preparation, {
      mode,
      pr,
      run,
      codeSha,
    }),
    { candidate, testedArtifact } = bundle;
  if (
    testedArtifact?.checksum !== candidate.artifact ||
    testedArtifact?.key !==
      testedArtifactKey(mode, pr, run, candidate.artifact) ||
    !Number.isSafeInteger(testedArtifact.bytes) ||
    testedArtifact.bytes < 1 ||
    testedArtifact.bytes > 256 * 1024 * 1024 ||
    candidate.archive !==
      `rollback/artifacts/${namespace}/${candidate.artifact}.tar`
  )
    throw new Error("Tested artifact handoff identity differs");
  const bytes = Buffer.from(
      await archiveTransfer(
        store,
        "download",
        testedArtifact.key,
        undefined,
        candidate.artifact,
      ),
    ),
    marker = validateBuiltArtifact(bytes, candidate.artifact, {
      account,
      mode,
      publication: artifactPublication(namespace, run, candidate),
    });
  if (
    bytes.length !== testedArtifact.bytes ||
    JSON.stringify(marker) !== JSON.stringify(candidate.verification.marker)
  )
    throw new Error("Tested archive proof differs");
  if (mode !== "production") {
    const compiled = await compilePrivateWorker({
        account,
        mode,
        images: candidate.verification.prepared.images,
        controlWorkspace,
      }),
      worker = validatePrivateWorkerArchive(
        bytes,
        candidate.artifact,
        compiled,
      );
    if (
      JSON.stringify(worker) !== JSON.stringify(candidate.verification.worker)
    )
      throw new Error("Tested Worker authority proof differs");
  }
  const prior = await store.get(candidate.archive, 256 * 1024 * 1024);
  if (prior && !Buffer.from(prior).equals(bytes))
    throw new Error("Retained tested archive already differs");
  if (!prior) await store.put(candidate.archive, bytes, true);
  const retained = await store.get(candidate.archive, 256 * 1024 * 1024);
  if (
    !retained ||
    retained.byteLength !== bytes.length ||
    archiveChecksum(retained) !== candidate.artifact
  )
    throw new Error("Retained tested archive readback differs");
  const after = await execute("git", ["rev-parse", "HEAD"], {
    cwd,
    purpose: "build",
  });
  if (after.stdout.trim() !== codeSha)
    throw new Error("Deployment code changed after artifact verification");
  if (
    mode === "preview" &&
    currentPreview(await github.pull(pr), pr).codeSha !== codeSha
  )
    throw new Error("Preview changed before tested artifact deployment");
  return record(candidate, bundle.diagnostics, {
    store,
    serving,
    namespace,
    bootstrap,
    run,
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      run: { type: "string" },
      "code-sha": { type: "string" },
      preparation: { type: "string" },
      access: { type: "string" },
      "bootstrap-receipt": { type: "string" },
      bootstrap: { type: "boolean", default: false },
      "control-workspace": { type: "string", default: process.cwd() },
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
      ),
      pr = values.pr ? Number(values.pr) : undefined,
      serving = new CloudflareServing({
        account: values.account,
        mode: values.mode,
        pr,
        token:
          values.mode === "staging"
            ? process.env.CLOUDFLARE_STAGING_API_TOKEN
            : process.env.CLOUDFLARE_API_TOKEN,
        accessConfig: values.access
          ? await readPrivatePreparation(values.access)
          : undefined,
        accessToken: process.env.CLOUDFLARE_ACCESS_API_TOKEN,
        credentials: {
          clientId: process.env.CF_ACCESS_CLIENT_ID,
          clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
        },
        store,
        bootstrapReceipt: values["bootstrap-receipt"]
          ? await readPrivatePreparation(values["bootstrap-receipt"])
          : undefined,
        workspace: values["control-workspace"],
      });
    console.log(
      JSON.stringify(
        await deployPublicationTarget({
          store,
          serving,
          mode: values.mode,
          pr,
          run: values.run,
          codeSha: values["code-sha"],
          preparation: values.preparation,
          account: values.account,
          controlWorkspace: values["control-workspace"],
          bootstrap: values.bootstrap,
          github:
            values.mode === "preview"
              ? publicationGitHub(process.env.GITHUB_TOKEN)
              : undefined,
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
      "Tested artifact publication failed; inspect protected target state and credentials",
    );
    process.exitCode = 1;
  });
