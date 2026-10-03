import { rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { mode: { type: "string", default: "preview" } },
});
if (!["production", "preview"].includes(values.mode))
  throw new Error("Build mode must be production or preview");

rmSync("dist", { recursive: true, force: true });
mkdirSync(".cloudflare", { recursive: true });
for (const [command, args] of [
  [
    "go",
    ["run", "./cmd/export-static", "--out", "dist", "--mode", values.mode],
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
