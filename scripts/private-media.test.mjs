import assert from "node:assert/strict";
import { test } from "node:test";
import { privateImage, privateSite } from "../worker/media.mjs";

const key = `v1/${"a".repeat(64)}.png`;
const record = {
  key,
  size: 4,
  sha256: "a".repeat(64),
  md5: "b".repeat(32),
  contentType: "image/png",
};
const url = `https://private.example/__obsidian/media/${key}`;
const makeObject = () => ({
  size: 4,
  httpMetadata: { contentType: "image/png" },
  customMetadata: { sha256: record.sha256, md5: record.md5 },
  body: new Response(new Uint8Array([1, 2, 3, 4])).body,
});

test("private images stream GET, use metadata-only HEAD, and never authorize arbitrary objects", async () => {
  const calls = [];
  const bucket = {
    head: async (key) => {
      calls.push(["HEAD", key]);
      return makeObject();
    },
    get: async (key) => {
      calls.push(["GET", key]);
      return makeObject();
    },
  };
  let response = await privateImage(new Request(url), bucket, {
    [key]: record,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([1, 2, 3, 4]),
  );
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  response = await privateImage(new Request(url, { method: "HEAD" }), bucket, {
    [key]: record,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  for (const path of [
    "markdown/v1/abc.md",
    "latest.json",
    "v1/bad.png",
    `${key}?download=1`,
    key.replace("a", "%61"),
    `v1/${"c".repeat(64)}.png`,
  ])
    assert.equal(
      (
        await privateImage(
          new Request(`https://private.example/__obsidian/media/${path}`),
          bucket,
          { [key]: record },
        )
      ).status,
      404,
    );
  assert.equal(calls.length, 2);
  assert.equal(
    (
      await privateImage(new Request(url, { method: "POST" }), bucket, {
        [key]: record,
      })
    ).status,
    405,
  );
  assert.equal(calls.length, 2);
});

test("metadata corruption fails closed and streaming enforces the expected length", async () => {
  const bucket = {
    get: async () => ({
      ...makeObject(),
      customMetadata: { sha256: "corrupt" },
    }),
  };
  assert.equal(
    (await privateImage(new Request(url), bucket, { [key]: record })).status,
    404,
  );
  for (const bytes of [new Uint8Array(3), new Uint8Array(5)]) {
    const response = await privateImage(
      new Request(url),
      {
        get: async () => ({ ...makeObject(), body: new Response(bytes).body }),
      },
      { [key]: record },
    );
    await assert.rejects(response.arrayBuffer());
  }
});

test("all private HTML, static assets, redirects, missing routes and sitemaps disable caching", async () => {
  const env = {
    ASSETS: {
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/failure") throw new Error("private filename failure");
        return new Response("asset", {
          status: path === "/missing" ? 404 : path === "/redirect" ? 301 : 200,
          headers: {
            "cache-control": "public, max-age=3600",
            ...(path === "/redirect" ? { location: "/" } : {}),
          },
        });
      },
    },
  };
  for (const path of [
    "/",
    "/asset.js",
    "/sitemap.xml",
    "/missing",
    "/redirect",
    "/failure",
  ]) {
    const response = await privateSite(
      new Request(`https://private.example${path}`),
      env,
      {},
    );
    assert.match(
      response.headers.get("cache-control"),
      /private.*no-store.*no-transform/,
    );
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.equal(
      response.status,
      path === "/missing"
        ? 404
        : path === "/redirect"
          ? 301
          : path === "/failure"
            ? 503
            : 200,
    );
    if (path === "/failure") assert.equal(await response.text(), "");
  }
});
