import { mkdir, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export async function writeWorkflowSecrets(
  { target, accessJson, bootstrapReceiptJson, bootstrapRequired = false },
  cwd = process.cwd(),
) {
  if (!["staging", "preview", "production"].includes(target))
    throw new Error("Invalid workflow secret target");
  if (target !== "production" && !accessJson)
    throw new Error("Protected target Access configuration is required");
  if (bootstrapRequired && !bootstrapReceiptJson)
    throw new Error("Explicit verified bootstrap receipt is required");
  const directory = resolve(cwd, ".obsidian-publish/workflow", target),
    root = resolve(cwd, ".obsidian-publish");
  if (!directory.startsWith(`${root}/`))
    throw new Error("Private workflow output path escaped ignored storage");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const actualRoot = await realpath(root);
  if (!(await realpath(directory)).startsWith(`${actualRoot}/`))
    throw new Error("Private workflow output path escaped ignored storage");
  const outputs = {};
  if (accessJson) {
    const config = JSON.parse(accessJson);
    if (
      config?.mode !== target ||
      !/^[a-f0-9]{32}$/.test(config.account ?? "") ||
      !uuid.test(config.application ?? "") ||
      !uuid.test(config.worker ?? "") ||
      !uuid.test(config.serviceToken ?? "") ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.team ?? "") ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.owner ?? "") ||
      !Array.isArray(config.hosts) ||
      config.hosts.length < 1 ||
      config.hosts.some((host) => typeof host !== "string" || !host)
    )
      throw new Error("Protected target Access configuration is invalid");
    outputs.access = `${directory}/access.json`;
    await writeFile(outputs.access, JSON.stringify(config), {
      mode: 0o600,
      flag: "wx",
    });
  }
  if (bootstrapReceiptJson) {
    const receipt = JSON.parse(bootstrapReceiptJson);
    if (!uuid.test(receipt?.deployment ?? ""))
      throw new Error("Verified bootstrap receipt is invalid");
    outputs.bootstrapReceipt = `${directory}/bootstrap-receipt.json`;
    await writeFile(outputs.bootstrapReceipt, JSON.stringify(receipt), {
      mode: 0o600,
      flag: "wx",
    });
  }
  return outputs;
}

async function main() {
  const target = process.env.OBSIDIAN_WORKFLOW_TARGET,
    outputs = await writeWorkflowSecrets(
      {
        target,
        accessJson: process.env.OBSIDIAN_ACCESS_CONFIG,
        bootstrapReceiptJson: process.env.OBSIDIAN_BOOTSTRAP_RECEIPT,
        bootstrapRequired: process.env.OBSIDIAN_BOOTSTRAP_REQUIRED === "true",
      },
      process.cwd(),
    );
  if (process.env.GITHUB_OUTPUT)
    await writeFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + (Object.keys(outputs).length ? "\n" : ""),
      { flag: "a" },
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error("Protected workflow inputs are missing or invalid");
    process.exitCode = 1;
  });
