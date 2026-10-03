import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentRecord } from "./record-cloudflare-deployment.mjs";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

const verifier = fileURLToPath(
  new URL("./verify-cloudflare.mjs", import.meta.url),
);
const run = promisify(execFile);
const html = "<!doctype html><title>Test</title>";
const redirects = {
  "/about/": [301, "/about"],
  "/make/": [301, "/make"],
  "/word/": [301, "/word"],
  "/programming/": [301, "/programming"],
  "/poem": [307, "/poem/"],
  "/aphorism": [307, "/aphorism/"],
};

for (const scenario of [
  {
    name: "indexable production",
    mode: "production",
    noindex: false,
    success: true,
  },
  {
    name: "unindexable preview",
    mode: "preview",
    noindex: true,
    success: true,
  },
  {
    name: "production noindex rejected",
    mode: "production",
    noindex: true,
    success: false,
  },
  {
    name: "preview indexing rejected",
    mode: "preview",
    noindex: false,
    success: false,
  },
  {
    name: "changed HTML rejected",
    mode: "production",
    noindex: false,
    success: false,
    mismatch: true,
  },
  {
    name: "lost redirect query rejected",
    mode: "production",
    noindex: false,
    success: false,
    dropQuery: true,
  },
]) {
  test(scenario.name, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "cloudflare-verifier-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    mkdirSync(join(directory, ".cloudflare"));
    mkdirSync(join(directory, "dist"));
    writeFileSync(
      join(directory, ".cloudflare/site-manifest.json"),
      JSON.stringify({ pages: ["/"], assets: ["/grass/worker.js"] }),
    );
    writeFileSync(join(directory, "dist/index.html"), html);
    const server = createServer((request, response) => {
      const url = new URL(request.url, "http://localhost");
      if (scenario.noindex) response.setHeader("X-Robots-Tag", "noindex");
      if (redirects[url.pathname]) {
        const [status, location] = redirects[url.pathname];
        response.writeHead(status, {
          location: location + (scenario.dropQuery ? "" : url.search),
        });
      } else if (url.pathname === "/") {
        response.writeHead(200);
        response.end(scenario.mismatch ? "different" : html);
        return;
      } else if (url.pathname === "/grass/worker.js") {
        response.writeHead(200, { "Cache-Control": "no-store" });
      } else response.writeHead(404);
      response.end();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    let result;
    try {
      result = await run(
        process.execPath,
        [verifier, base, "--mode", scenario.mode],
        { cwd: directory },
      );
    } catch (error) {
      result = error;
    }
    assert.equal(
      !result.code,
      scenario.success,
      result.stdout || result.message,
    );
  });
}
