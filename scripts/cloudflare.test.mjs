import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentRecord } from "./record-cloudflare-deployment.mjs";

const version = "12345678-1234-1234-1234-123456789abc";
const deployments = [
  { id: "deployment", versions: [{ version_id: version, percentage: 100 }] },
];

test("production records do not depend on a workers.dev URL", () => {
  const record = deploymentRecord(
    `Current Version ID: ${version}`,
    "production",
    deployments,
  );
  assert.equal(record.versionId, version);
  assert.deepEqual(record.urls, [
    "https://justindfuller.com",
    "https://www.justindfuller.com",
  ]);
});

test("production recording rejects an inactive or split version", () => {
  assert.throws(() =>
    deploymentRecord(`Current Version ID: ${version}`, "production", []),
  );
  assert.throws(() =>
    deploymentRecord(`Current Version ID: ${version}`, "production", [
      { id: "deployment", versions: [{ version_id: version, percentage: 50 }] },
    ]),
  );
});

test("staging records preserve the separate public routing boundary", () => {
  const record = deploymentRecord(
    `Current Version ID: ${version}`,
    "staging",
    deployments,
  );
  assert.deepEqual(record.urls, ["https://staging.justindfuller.com"]);
  assert.equal(record.versionId, version);
});

test("preview records distinguish stable and exact deployment URLs", () => {
  const record = deploymentRecord(
    JSON.stringify({
      type: "preview",
      preview_id: "preview",
      preview_name: "pr-123",
      deployment_id: "deployment",
      preview_urls: ["https://pr-123.example.workers.dev"],
      deployment_urls: ["https://deployment.example.workers.dev"],
    }),
    "preview",
  );
  assert.equal(record.previewUrl, "https://pr-123.example.workers.dev");
  assert.equal(record.url, "https://deployment.example.workers.dev");
  assert.equal(record.versionId, null);
  assert.throws(() =>
    deploymentRecord(JSON.stringify({ type: "preview" }), "preview"),
  );
});
