import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import {
  AccessClient,
  verifyAccessConfiguration,
  proveSentinels,
} from "./obsidian-access.mjs";

const { values } = parseArgs({
  options: {
    config: { type: "string" },
    sentinels: { type: "string" },
    out: { type: "string", default: ".obsidian-publish/access-proof.json" },
  },
});
try {
  if (!values.config || !values.sentinels)
    throw new Error("Configuration required");
  const config = JSON.parse(readFileSync(values.config, "utf8"));
  const proofs = JSON.parse(readFileSync(values.sentinels, "utf8"));
  const credentials = {
    clientId: process.env.CF_ACCESS_CLIENT_ID,
    clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
  };
  const client = new AccessClient(
    config.account,
    process.env.CLOUDFLARE_ACCESS_API_TOKEN,
  );
  await verifyAccessConfiguration(client, {
    ...config,
    clientId: credentials.clientId,
  });
  await proveSentinels(proofs, config, credentials);
  mkdirSync(dirname(values.out), { recursive: true, mode: 0o700 });
  writeFileSync(
    values.out,
    JSON.stringify({
      version: 1,
      mode: config.mode,
      application: config.application,
      worker: config.worker,
      hosts: config.hosts,
      verifiedAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: "verified",
      mode: config.mode,
      destinations: proofs.length,
    }),
  );
} catch {
  console.error(
    "Private deployment blocked: Access configuration or sentinel proof failed",
  );
  process.exitCode = 1;
}
