import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readPrivatePreparation } from "./prepare-obsidian-target.mjs";
import { saveProtectedReport } from "./obsidian-reports.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";

export async function promotePreparedImages({
  overlay,
  source,
  acceptedOnly = false,
  out = ".obsidian-publish/promotion.json",
  unavailableOut = ".obsidian-publish/unavailable-images.json",
  cwd = process.cwd(),
  execute = runPublicationCommand,
  promote,
}) {
  if (
    !overlay ||
    Boolean(source) === acceptedOnly ||
    typeof promote !== "function"
  )
    throw new Error(
      "Pinned source or explicit accepted-state promotion required",
    );
  const paths = [overlay, source, out, unavailableOut]
    .filter(Boolean)
    .map((path) => resolve(cwd, path));
  if (new Set(paths).size !== paths.length)
    throw new Error("Distinct private promotion files required");
  const prepared = await readPrivatePreparation(overlay, cwd),
    pinned = source ? await readPrivatePreparation(source, cwd) : undefined;
  if (
    prepared?.mode !== "production" ||
    !/^[a-f0-9]{64}$/.test(prepared.revision ?? "") ||
    (pinned &&
      (pinned.revision !== prepared.revision ||
        !pinned.ready ||
        typeof pinned.ready !== "object" ||
        Array.isArray(pinned.ready)))
  )
    throw new Error("Production source correlation differs");
  await execute(
    "go",
    ["run", "./cmd/prepare-obsidian", "--validate-promotion", overlay],
    { cwd, purpose: "build" },
  );
  await saveProtectedReport(out, {}, cwd);
  await saveProtectedReport(unavailableOut, [], cwd);
  if (pinned) await saveProtectedReport(source, pinned, cwd);
  const result = await promote(prepared),
    eligible = new Set(Object.keys(prepared.images ?? {}));
  if (
    !result ||
    !Array.isArray(result.verified) ||
    !Array.isArray(result.unavailable) ||
    [...result.verified, ...result.unavailable].some(
      (key) => !eligible.has(key),
    ) ||
    new Set([...result.verified, ...result.unavailable]).size !==
      eligible.size ||
    result.verified.length + result.unavailable.length !== eligible.size ||
    !Number.isSafeInteger(result.copied) ||
    result.copied < 0 ||
    result.copied > result.verified.length ||
    !Number.isSafeInteger(result.bytes) ||
    result.bytes < 0
  )
    throw new Error("Production destination verification is incomplete");
  if (pinned) {
    for (const key of result.unavailable) pinned.ready[key] = false;
    await saveProtectedReport(source, pinned, cwd);
  }
  await saveProtectedReport(unavailableOut, result.unavailable, cwd);
  await saveProtectedReport(out, result, cwd);
  return {
    verified: result.verified.length,
    unavailable: result.unavailable.length,
    copied: result.copied,
    bytes: result.bytes,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      overlay: { type: "string" },
      source: { type: "string" },
      "accepted-only": { type: "boolean", default: false },
      account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
      out: { type: "string", default: ".obsidian-publish/promotion.json" },
      "unavailable-out": {
        type: "string",
        default: ".obsidian-publish/unavailable-images.json",
      },
    },
  });
  const { promoteProductionImages, r2Target, environmentTransport } =
    await import("../tools/obsidian-image-publisher/src/publication.ts");
  let sourceTransport, mediaTransport;
  try {
    const result = await promotePreparedImages({
      overlay: values.overlay,
      source: values.source,
      acceptedOnly: values["accepted-only"],
      out: values.out,
      unavailableOut: values["unavailable-out"],
      promote: async (prepared) => {
        sourceTransport = environmentTransport("OBSIDIAN_SOURCE");
        mediaTransport = environmentTransport("OBSIDIAN_MEDIA");
        return promoteProductionImages(
          prepared,
          {
            transport: sourceTransport,
            target: r2Target(values.account, "justindfuller-obsidian-source"),
          },
          {
            transport: mediaTransport,
            target: r2Target(values.account, "justindfuller-obsidian-media"),
          },
        );
      },
    });
    console.log(JSON.stringify(result));
  } finally {
    sourceTransport?.close();
    mediaTransport?.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Production image promotion failed; public deployment blocked",
    );
    process.exitCode = 1;
  });
