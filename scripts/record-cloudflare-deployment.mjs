import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const output = readFileSync("cloudflare-deployment.log", "utf8").replace(
  /\u001b\[[0-9;]*m/g,
  "",
);
const url = output.match(
  /https:\/\/justindfuller-site\.[a-z0-9-]+\.workers\.dev/,
)?.[0];
if (!url)
  throw new Error("Deployment output did not contain a workers.dev URL");
writeFileSync(".cloudflare/deployed-url.txt", url);
const version = output.match(/Current Version ID: ([a-f0-9-]+)/)?.[1];
const deployments = JSON.parse(
  execFileSync(
    "npx",
    [
      "cf",
      "workers",
      "deployments",
      "list",
      "--worker",
      "justindfuller-site",
      "--mode",
      "staging",
    ],
    { encoding: "utf8" },
  ),
).deployments;
const deployment = deployments[0];
if (
  !version ||
  !deployment?.versions.some(
    (item) => item.version_id === version && item.percentage === 100,
  )
)
  throw new Error("Latest deployment does not serve the uploaded version");
const record = {
  commit:
    process.env.GITHUB_SHA ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  artifactChecksum: readFileSync("cloudflare-artifact.sha256", "utf8").split(
    /\s+/,
  )[0],
  deploymentId: deployment.id,
  versionId: version,
  url,
};
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
