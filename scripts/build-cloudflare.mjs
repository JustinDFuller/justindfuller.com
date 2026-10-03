import { rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

rmSync("dist", { recursive: true, force: true });
mkdirSync(".cloudflare", { recursive: true });
for (const [command, args] of [
  ["go", ["run", "./cmd/export-static", "--out", "dist"]],
  ["cf", ["build", "--mode", "staging"]],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
