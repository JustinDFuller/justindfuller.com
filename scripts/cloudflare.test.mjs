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
import { createHash } from "node:crypto";

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
    name: "asset filenames with spaces and unicode retain their filesystem spelling",
    mode: "production",
    noindex: false,
    success: true,
    encodedAssets: true,
  },
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
    name: "missing transformation protection rejected",
    mode: "production",
    noindex: false,
    success: false,
    transformable: true,
  },
  {
    name: "transient previous-revision HTML converges",
    mode: "production",
    noindex: false,
    success: true,
    transient: true,
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
  {
    name: "public images are verified by exact bytes and immutable caching",
    mode: "production",
    noindex: false,
    success: true,
    media: true,
  },
  {
    name: "public image byte mismatch rejected",
    mode: "production",
    noindex: false,
    success: false,
    media: true,
    mediaBody: "changed",
  },
  {
    name: "public image caching mismatch rejected",
    mode: "production",
    noindex: false,
    success: false,
    media: true,
    mediaCache: "private, no-store",
  },
  {
    name: "public image MIME mismatch rejected",
    mode: "production",
    noindex: false,
    success: false,
    media: true,
    mediaType: "text/html",
  },
]) {
  test(scenario.name, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "cloudflare-verifier-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    mkdirSync(join(directory, ".cloudflare"));
    mkdirSync(join(directory, "dist"));
    writeFileSync(
      join(directory, ".cloudflare/site-manifest.json"),
      JSON.stringify({
        pages: ["/"],
        assets: [
          "/grass/worker.js",
          ...(scenario.encodedAssets ? ["/image/Weeks Remaining-é.svg"] : []),
        ],
      }),
    );
    writeFileSync(join(directory, "dist/index.html"), html);
    if (scenario.encodedAssets) {
      mkdirSync(join(directory, "dist/image"));
      writeFileSync(
        join(directory, "dist/image/Weeks Remaining-é.svg"),
        "verified encoded asset",
      );
    }
    const mediaArgs = [];
    if (scenario.media) {
      const bytes = "verified image bytes",
        sha256 = createHash("sha256").update(bytes).digest("hex"),
        key = `v1/${sha256}.png`;
      const record = {
        key,
        sha256,
        size: Buffer.byteLength(bytes),
        contentType: "image/png",
      };
      const overlayPath = join(directory, "prepared.json"),
        hookPath = join(directory, "fixture-fetch.mjs");
      writeFileSync(overlayPath, JSON.stringify({ images: { [key]: record } }));
      writeFileSync(
        hookPath,
        `const original = globalThis.fetch; globalThis.fetch = async (input, options) => { const url = new URL(input); if (url.hostname !== "media.justindfuller.com") return original(input, options); if (url.pathname !== ${JSON.stringify(`/${key}`)} || options.headers["Accept-Encoding"] !== "identity") throw new Error("Unexpected media verification request"); return new Response(${JSON.stringify(scenario.mediaBody ?? bytes)}, { headers: { "Content-Type": ${JSON.stringify(scenario.mediaType ?? record.contentType)}, "Content-Length": ${JSON.stringify(String(record.size))}, "Cache-Control": ${JSON.stringify(scenario.mediaCache ?? "public, max-age=31536000, immutable")} } }); };`,
      );
      mediaArgs.push("--import", hookPath);
    }
    let homeRequests = 0;
    const server = createServer((request, response) => {
      const url = new URL(request.url, "http://localhost");
      if (scenario.noindex) response.setHeader("X-Robots-Tag", "noindex");
      if (redirects[url.pathname]) {
        const [status, location] = redirects[url.pathname];
        response.writeHead(status, {
          location: location + (scenario.dropQuery ? "" : url.search),
        });
      } else if (url.pathname === "/") {
        homeRequests++;
        if (!scenario.transformable)
          response.setHeader(
            "Cache-Control",
            "public, max-age=0, must-revalidate, no-transform",
          );
        response.writeHead(200);
        response.end(
          scenario.mismatch || (scenario.transient && homeRequests === 1)
            ? "different"
            : html,
        );
        return;
      } else if (
        scenario.encodedAssets &&
        decodeURIComponent(url.pathname) === "/image/Weeks Remaining-é.svg"
      ) {
        response.writeHead(200, { "Cache-Control": "no-transform" });
        response.end("verified encoded asset");
        return;
      } else if (url.pathname === "/grass/worker.js") {
        response.writeHead(200, { "Cache-Control": "no-transform, no-store" });
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
        [
          ...(scenario.media ? mediaArgs.slice(0, 2) : []),
          verifier,
          base,
          "--mode",
          scenario.mode,
          "--attempts",
          "2",
          "--retry-delay-ms",
          "10",
          ...(scenario.media
            ? ["--overlay", join(directory, "prepared.json")]
            : []),
        ],
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
    if (scenario.transient) assert.ok(homeRequests > 2);
  });
}
