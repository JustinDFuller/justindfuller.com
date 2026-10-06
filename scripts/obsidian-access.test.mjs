import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  AccessClient,
  checkAccessConfiguration,
  verifyAccessConfiguration,
  assertAccessDenied,
  proveSentinels,
  boundedBody,
} from "./obsidian-access.mjs";

const config = {
  application: "a".repeat(32),
  worker: "b".repeat(32),
  serviceToken: "c".repeat(32),
  clientId: "ci-client",
  owner: "owner@example.com",
  mode: "staging",
  hosts: ["staging.example.com"],
  team: "example.cloudflareaccess.com",
};
function fixture(mode = "staging") {
  return {
    ...config,
    mode,
    applications: [
      {
        id: config.application,
        type: "self_hosted",
        destinations: [
          {
            type: mode === "staging" ? "worker" : "preview_worker",
            worker_id: config.worker,
          },
        ],
      },
    ],
    policies: [
      { decision: "allow", include: [{ email: { email: config.owner } }] },
      {
        decision: "non_identity",
        include: [{ service_token: { token_id: config.serviceToken } }],
      },
    ],
    tokens: [
      {
        id: config.serviceToken,
        client_id: config.clientId,
        expires_at: "2030-01-01T00:00:00Z",
      },
    ],
    now: Date.parse("2026-10-04T00:00:00Z"),
  };
}

test("Access gate requires exact owner, expiring service token and entire destination", () => {
  for (const mode of ["staging", "preview"])
    checkAccessConfiguration(fixture(mode));
  for (const mutate of [
    (f) => {
      f.applications[0].destinations = [];
    },
    (f) => {
      f.applications[0].destinations[0].type = "preview_worker";
    },
    (f) => {
      f.applications[0].destinations[0].worker_id = "d".repeat(32);
    },
    (f) => {
      f.policies[0].decision = "bypass";
    },
    (f) => {
      f.policies[0].include = [{ everyone: {} }];
    },
    (f) => {
      f.policies[0].include[0].email.email = "other@example.com";
    },
    (f) => {
      f.policies[0].include.push({ email: { email: "other@example.com" } });
    },
    (f) => {
      f.policies[0].require = [{ everyone: {} }];
    },
    (f) => {
      f.policies[1].include[0].service_token.token_id = "e".repeat(32);
    },
    (f) => {
      f.tokens[0].expires_at = "never";
    },
    (f) => {
      f.tokens[0].expires_at = "2025-01-01";
    },
    (f) => {
      f.tokens[0].client_id = "wrong-client";
    },
    (f) => {
      f.policies.push({ decision: "bypass", include: [{ everyone: {} }] });
    },
    (f) => {
      f.applications.push({
        id: "e".repeat(32),
        destinations: [{ type: "all_workers" }],
      });
    },
    (f) => {
      f.applications.push({ id: "e".repeat(32), domain: "*.example.com" });
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => checkAccessConfiguration(f));
  }
});

test("API read paginates and rejects permission errors, incomplete payloads and oversized reads", async () => {
  let calls = 0;
  const client = new AccessClient(
    "a".repeat(32),
    "test-token",
    async (url, options) => {
      assert.equal(new URL(url).hostname, "api.cloudflare.com");
      assert.equal(options.redirect, "error");
      calls++;
      return Response.json({
        success: true,
        result: Array(calls === 1 ? 100 : 1).fill({}),
        result_info: { total_pages: 2 },
      });
    },
  );
  assert.equal((await client.list("apps")).length, 101);
  assert.equal(calls, 2);
  for (const response of [
    new Response("unauthorized", { status: 403 }),
    Response.json({ success: false, result: [] }),
  ])
    await assert.rejects(
      new AccessClient("a".repeat(32), "test-token", async () => response).list(
        "apps",
      ),
    );
  await assert.rejects(boundedBody(new Response("too large"), 3), /limit/);
  const f = fixture();
  await verifyAccessConfiguration(
    {
      list: async (resource) =>
        resource === "apps"
          ? f.applications
          : resource === "service_tokens"
            ? f.tokens
            : f.policies,
    },
    f,
  );
});

test("anonymous, identity spoof and invalid service token are denied before and after sentinel warmup", async () => {
  const sentinel = Buffer.from("nonsensitive staging sentinel");
  const digest = createHash("sha256").update(sentinel).digest("hex");
  const proofs = [
    {
      url: "https://staging.example.com/sentinel",
      sha256: digest,
      size: sentinel.length,
    },
  ];
  const credentials = {
    clientId: config.clientId,
    clientSecret: "test-secret",
  };
  const seen = [];
  const transport = async (url, options) => {
    assert.equal(new URL(url).hostname, config.hosts[0]);
    assert.equal(options.redirect, "manual");
    seen.push(options.headers);
    if (options.headers["CF-Access-Client-Secret"] === "test-secret")
      return new Response(sentinel);
    return new Response("Access denied", { status: 403 });
  };
  await proveSentinels(proofs, config, credentials, transport);
  assert.equal(seen.length, 7);
  assert.deepEqual(seen[0], seen[4]);
  for (const bad of [
    async () => new Response(sentinel),
    async () => new Response(sentinel, { status: 403 }),
    async () =>
      new Response("", {
        status: 302,
        headers: { location: "https://evil.example/login" },
      }),
  ])
    await assert.rejects(proveSentinels(proofs, config, credentials, bad));
  await assertAccessDenied(
    proofs[0].url,
    credentials,
    config.team,
    async () =>
      new Response("", {
        status: 302,
        headers: {
          location: `https://${config.team}/cdn-cgi/access/login/example`,
        },
      }),
  );
  await assert.rejects(
    proveSentinels(
      proofs,
      { ...config, hosts: [...config.hosts, "alias.example.com"] },
      credentials,
      transport,
    ),
  );
});
