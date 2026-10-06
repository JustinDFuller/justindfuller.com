import { rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { publicationEnvironment } from "./obsidian-process.mjs";

const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "preview" },
    overlay: { type: "string" },
    "publication-id": { type: "string" },
  },
});
if (!["production", "preview", "staging"].includes(values.mode))
  throw new Error("Build mode must be production, preview or staging");

rmSync("dist", { recursive: true, force: true });
mkdirSync(".cloudflare", { recursive: true });
const images = values.overlay
  ? JSON.parse(readFileSync(values.overlay, "utf8")).images
  : {};
writeFileSync(
  ".cloudflare/private-images.mjs",
  `export default ${JSON.stringify(values.mode === "production" ? {} : images)};\n`,
  { mode: 0o600 },
);
for (const [command, args] of [
  [
    "go",
    [
      "run",
      "./cmd/export-static",
      "--out",
      "dist",
      "--mode",
      values.mode,
      ...(values.overlay ? ["--overlay", values.overlay] : []),
    ],
  ],
  ["cf", ["build", "--mode", values.mode]],
]) {
  if (command === "cf" && values["publication-id"]) {
    if (!/^[a-f0-9]{64}$/.test(values["publication-id"]))
      throw new Error("Invalid publication identity");
    writeFileSync(
      "dist/__publication.json",
      JSON.stringify({ version: 1, publication: values["publication-id"] }),
    );
    const manifest = JSON.parse(
      readFileSync(".cloudflare/site-manifest.json", "utf8"),
    );
    manifest.assets.push("/__publication.json");
    writeFileSync(".cloudflare/site-manifest.json", JSON.stringify(manifest));
  }
  const result = spawnSync(command, args, {
    stdio: values.overlay ? "pipe" : "inherit",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...(values.overlay
        ? publicationEnvironment(process.env, "build")
        : process.env),
      CLOUDFLARE_PREVIEW_BUILD: String(values.mode === "preview"),
    },
  });
  if (result.error || result.status !== 0) {
    console.error("Cloudflare artifact build failed");
    process.exit(result.status || 1);
  }
}
