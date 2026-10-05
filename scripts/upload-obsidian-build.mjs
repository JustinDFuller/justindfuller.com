import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  downloadPreparationBundle,
  uploadPreparationBundle,
} from "./obsidian-pipeline.mjs";
import {
  artifactPublication,
  testedArtifactKey,
  validateBuiltArtifact,
} from "./build-obsidian-target.mjs";
import { archiveTransfer } from "./obsidian-private-storage.mjs";
import { archiveChecksum } from "./obsidian-archive.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";

const accountDefault = "9dce34804a27754a4ea66a5789827dfa";
const maxArchiveBytes = 256 * 1024 * 1024;

export async function readPrivateBuildFile(
  path,
  cwd = process.cwd(),
  limit = 2 * 1024 * 1024,
) {
  const base = await realpath(cwd),
    root = resolve(base, ".obsidian-publish"),
    file = resolve(base, path);
  if (!file.startsWith(`${root}/`) || (await lstat(file)).isSymbolicLink())
    throw new Error("Ignored private build input required");
  const actual = await realpath(file),
    size = await stat(actual);
  if (!actual.startsWith(`${root}/`) || !size.isFile() || size.size > limit)
    throw new Error("Bounded ignored private build input required");
  return readFile(actual);
}

export async function uploadPrivateBuild({
  store,
  mode,
  pr,
  run,
  codeSha,
  preparation,
  account = accountDefault,
  cwd = process.cwd(),
}) {
  const namespace = targetNamespace(mode, pr),
    target = { mode, pr, run, codeSha },
    bundle = await downloadPreparationBundle(store, preparation, target),
    input = JSON.parse(
      await readPrivateBuildFile(
        `.obsidian-publish/hosted/${namespace}/build-input.json`,
        cwd,
        64 * 1024 * 1024,
      ),
    ),
    rendered = JSON.parse(
      await readPrivateBuildFile(
        `.obsidian-publish/hosted/${namespace}/rendered.json`,
        cwd,
      ),
    );
  if (
    input.version !== 1 ||
    input.target !== namespace ||
    input.run !== run ||
    input.codeSha !== codeSha ||
    input.preparation !== preparation ||
    input.publication !==
      artifactPublication(namespace, run, bundle.candidate) ||
    rendered.version !== 1 ||
    rendered.target !== namespace ||
    rendered.run !== run ||
    rendered.codeSha !== codeSha ||
    rendered.preparation !== preparation ||
    rendered.publication !== input.publication
  )
    throw new Error("Rendered private archive identity differs");
  const archive = JSON.parse(
      await readPrivateBuildFile(
        `.obsidian-publish/hosted/${namespace}/rendered.tar`,
        cwd,
        Math.ceil((maxArchiveBytes * 4) / 3) + 1024,
      ),
    ),
    bytes = Buffer.from(archive.bytes ?? "", "base64"),
    checksum = archiveChecksum(bytes);
  if (
    bytes.length > maxArchiveBytes ||
    bytes.toString("base64") !== archive.bytes ||
    checksum !== rendered.checksum ||
    bytes.length !== rendered.bytes
  )
    throw new Error("Rendered archive bytes differ from the tested identity");
  const marker = validateBuiltArtifact(bytes, checksum, {
      account,
      mode,
      publication: input.publication,
    }),
    key = testedArtifactKey(mode, pr, run, checksum);
  if (
    JSON.stringify(marker) !== JSON.stringify(rendered.marker) ||
    !bundle.candidate.verification.prepared
  )
    throw new Error("Rendered archive proof differs from its preparation");
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
  await saveProtectedReport(
    `.obsidian-publish/hosted/${namespace}/uploaded.json`,
    { version: 1, target: namespace, run, codeSha, checksum, handoff },
    cwd,
  );
  return { version: 1, target: namespace, checksum, handoff };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      pr: { type: "string" },
      run: { type: "string" },
      "code-sha": { type: "string" },
      preparation: { type: "string" },
      account: { type: "string", default: accountDefault },
    },
  });
  const transport = environmentTransport("OBSIDIAN_STATE");
  try {
    const store = new PrivateR2Store(
      transport,
      r2Target(values.account, "justindfuller-obsidian-state"),
    );
    console.log(
      JSON.stringify(
        await uploadPrivateBuild({
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
    console.error("Private tested artifact upload failed");
    process.exitCode = 1;
  });
