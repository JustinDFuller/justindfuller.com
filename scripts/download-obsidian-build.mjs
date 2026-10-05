import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { downloadPreparationBundle } from "./obsidian-pipeline.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { artifactPublication } from "./build-obsidian-target.mjs";
import { targetNamespace } from "./obsidian-transaction.mjs";
import {
  PrivateR2Store,
  environmentTransport,
  r2Target,
} from "../tools/obsidian-image-publisher/src/publication.ts";

const accountDefault = "9dce34804a27754a4ea66a5789827dfa";

export async function downloadPrivateBuildInput({
  store,
  mode,
  pr,
  run,
  codeSha,
  preparation,
  cwd = process.cwd(),
}) {
  const namespace = targetNamespace(mode, pr),
    target = { mode, pr, run, codeSha },
    bundle = await downloadPreparationBundle(store, preparation, target),
    publication = artifactPublication(namespace, run, bundle.candidate),
    metadata = {
      version: 1,
      target: namespace,
      mode,
      pr,
      run,
      codeSha,
      preparation,
      publication,
      candidate: bundle.candidate,
    };
  await saveProtectedReport(
    `.obsidian-publish/hosted/${namespace}/build-input.json`,
    metadata,
    cwd,
  );
  return {
    version: 1,
    target: namespace,
    publication,
    preparation,
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
        await downloadPrivateBuildInput({
          store,
          mode: values.mode,
          pr: values.pr ? Number(values.pr) : undefined,
          run: values.run,
          codeSha: values["code-sha"],
          preparation: values.preparation,
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
    console.error("Private build input could not be verified");
    process.exitCode = 1;
  });
