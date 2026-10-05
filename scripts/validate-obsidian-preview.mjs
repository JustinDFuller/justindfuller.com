import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isolatedRenderer } from "./render-obsidian-build.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";

export async function validatePreviewCode({
  cwd = process.cwd(),
  goRoot,
  goModCache,
  execute = runPublicationCommand,
}) {
  const checks = [
    [
      "./node_modules/.bin/eslint",
      "-c",
      "eslint.config.mjs",
      "--quiet",
      "scripts",
    ],
    ["go", "test", "./..."],
    [
      "node",
      "--input-type=module",
      "-e",
      'import { readdirSync } from "node:fs"; import { spawnSync } from "node:child_process"; const paths = ["scripts", "tools/obsidian-image-publisher/tests"].flatMap(path => readdirSync(path).filter(name => /\\.test\\.(?:mjs|ts)$/.test(name)).sort().map(name => `${path}/${name}`)); const result = spawnSync(process.execPath, ["--test", ...paths], { stdio: "inherit" }); process.exit(result.status ?? 1);',
    ],
    [
      "./tools/obsidian-image-publisher/node_modules/.bin/tsc",
      "-p",
      "tools/obsidian-image-publisher",
      "--noEmit",
    ],
  ];
  for (const command of checks)
    await execute(
      "docker",
      [...isolatedRenderer(cwd, goRoot, goModCache), ...command],
      { cwd, purpose: "build" },
    );
  return { version: 1, checks: checks.length, validated: true };
}

async function main() {
  const { values } = parseArgs({
    options: {
      "go-root": { type: "string" },
      "go-mod-cache": { type: "string" },
    },
  });
  console.log(
    JSON.stringify(
      await validatePreviewCode({
        goRoot: values["go-root"],
        goModCache: values["go-mod-cache"],
      }),
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error("Preview code validation failed before private build input");
    process.exitCode = 1;
  });
