import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function deploymentRecord(output, mode, deployments = []) {
  output = output.replace(/\u001b\[[0-9;]*m/g, "");
  if (mode === "preview") {
    const preview = JSON.parse(output);
    if (
      preview.type !== "preview" ||
      !preview.deployment_id ||
      !preview.preview_id ||
      !preview.deployment_urls?.length ||
      !preview.preview_urls?.length
    )
      throw new Error(
        "Preview output is missing deployment identifiers or URLs",
      );
    return {
      mode,
      deploymentId: preview.deployment_id,
      versionId: null,
      previewId: preview.preview_id,
      previewName: preview.preview_name,
      url: preview.deployment_urls[0],
      urls: preview.deployment_urls,
      previewUrl: preview.preview_urls[0],
    };
  }
  if (!["production", "staging"].includes(mode))
    throw new Error("Unknown deployment mode");
  const version = output.match(/Current Version ID: ([a-f0-9-]+)/)?.[1];
  const deployment = deployments[0];
  if (
    !version ||
    !deployment?.versions.some(
      (item) => item.version_id === version && item.percentage === 100,
    )
  )
    throw new Error("Latest deployment does not serve the uploaded version");
  return {
    mode,
    deploymentId: deployment.id,
    versionId: version,
    url:
      mode === "staging"
        ? "https://staging.justindfuller.com"
        : "https://justindfuller.com",
    urls:
      mode === "staging"
        ? ["https://staging.justindfuller.com"]
        : ["https://justindfuller.com", "https://www.justindfuller.com"],
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const { values } = parseArgs({ options: { mode: { type: "string" } } });
  if (!["production", "preview", "staging"].includes(values.mode))
    throw new Error("Deployment mode must be production, preview or staging");
  const deployments =
    values.mode !== "preview"
      ? JSON.parse(
          execFileSync(
            "npx",
            [
              "cf",
              "workers",
              "deployments",
              "list",
              "--worker",
              values.mode === "staging"
                ? "justindfuller-site-staging"
                : "justindfuller-site",
              "--mode",
              values.mode,
            ],
            { encoding: "utf8" },
          ),
        ).deployments
      : [];
  const record = {
    commit:
      process.env.GITHUB_SHA ||
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    artifactChecksum: readFileSync("cloudflare-artifact.sha256", "utf8").split(
      /\s+/,
    )[0],
    ...deploymentRecord(
      readFileSync("cloudflare-deployment.log", "utf8"),
      values.mode,
      deployments,
    ),
  };
  writeFileSync(".cloudflare/deployed-url.txt", record.url);
  writeFileSync(
    ".cloudflare/deployment.json",
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log(JSON.stringify(record));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nCloudflare deployment:\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`,
    );
}
