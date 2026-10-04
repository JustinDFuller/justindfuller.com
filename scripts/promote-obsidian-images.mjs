import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import {
  promoteProductionImages,
  r2Target,
  environmentTransport,
} from "../tools/obsidian-image-publisher/src/publication.ts";

const { values } = parseArgs({
  options: {
    overlay: { type: "string" },
    source: { type: "string" },
    account: { type: "string", default: "9dce34804a27754a4ea66a5789827dfa" },
    out: { type: "string", default: ".obsidian-publish/promotion.json" },
  },
});
let sourceTransport, mediaTransport;
try {
  if (!values.overlay || !values.source)
    throw new Error("Pinned preparation inputs required");
  const validation = spawnSync(
    "go",
    ["run", "./cmd/prepare-obsidian", "--validate-promotion", values.overlay],
    { stdio: "pipe", maxBuffer: 1024 * 1024 },
  );
  if (validation.error || validation.status !== 0)
    throw new Error("Production image authorization failed");
  const prepared = JSON.parse(readFileSync(values.overlay, "utf8"));
  const pinned = JSON.parse(readFileSync(values.source, "utf8"));
  if (prepared.revision !== pinned.revision)
    throw new Error("Source revision mismatch");
  sourceTransport = environmentTransport("OBSIDIAN_SOURCE");
  mediaTransport = environmentTransport("OBSIDIAN_MEDIA");
  const result = await promoteProductionImages(
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
  for (const key of result.unavailable) pinned.ready[key] = false;
  writeFileSync(values.source, JSON.stringify(pinned), { mode: 0o600 });
  mkdirSync(dirname(values.out), { recursive: true, mode: 0o700 });
  writeFileSync(values.out, JSON.stringify(result), { mode: 0o600 });
  console.log(
    JSON.stringify({
      verified: result.verified.length,
      unavailable: result.unavailable.length,
      copied: result.copied,
      bytes: result.bytes,
    }),
  );
} catch {
  console.error("Production image promotion failed; public deployment blocked");
  process.exitCode = 1;
} finally {
  sourceTransport?.close();
  mediaTransport?.close();
}
