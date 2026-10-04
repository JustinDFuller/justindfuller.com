import { rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "preview" },
    overlay: { type: "string" },
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
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      CLOUDFLARE_PREVIEW_BUILD: String(values.mode === "preview"),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
