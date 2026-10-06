import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CloudflareServing,
  validateDeploymentArchive,
} from "./obsidian-cloudflare.mjs";
import {
  createPublicationArchive,
  archiveChecksum,
} from "./obsidian-archive.mjs";
import { PublicationTransaction } from "./obsidian-transaction.mjs";

const account = "a".repeat(32),
  worker = "b".repeat(32),
  app = "c".repeat(32),
  service = "d".repeat(32);
const priorId = "11111111-1111-1111-1111-111111111111",
  candidateId = "22222222-2222-2222-2222-222222222222",
  restoredId = "33333333-3333-3333-3333-333333333333";
function archive(directory, mode, nonce) {
  rmSync(join(directory, "dist"), { recursive: true, force: true });
  rmSync(join(directory, ".cloudflare"), { recursive: true, force: true });
  mkdirSync(join(directory, "dist"), { recursive: true });
  mkdirSync(join(directory, ".cloudflare/output/v0/workers/default/assets"), {
    recursive: true,
  });
  const bytes = Buffer.from(
    JSON.stringify({ version: 1, publication: nonce.repeat(64) }),
  );
  for (const path of [
    "dist/__publication.json",
    ".cloudflare/output/v0/workers/default/assets/__publication.json",
  ])
    writeFileSync(join(directory, path), bytes);
  writeFileSync(
    join(directory, ".cloudflare/output/v0/config.json"),
    JSON.stringify({
      accountId: account,
      buildContext: { mode, isPreview: mode === "preview" },
    }),
  );
  writeFileSync(
    join(directory, ".cloudflare/output/v0/workers/default/worker.config.json"),
    JSON.stringify({
      name:
        mode === "staging"
          ? "justindfuller-site-staging"
          : "justindfuller-site",
      workersDev: mode === "preview",
      previewUrls: mode !== "staging",
      domains:
        mode === "production"
          ? ["justindfuller.com", "www.justindfuller.com"]
          : mode === "staging"
            ? ["staging.justindfuller.com"]
            : [],
      env: {},
    }),
  );
  writeFileSync(join(directory, ".cloudflare/site-manifest.json"), "{}");
  const tar = createPublicationArchive(directory),
    checksum = archiveChecksum(tar);
  return {
    tar,
    bytes,
    receipt: {
      deployment: priorId,
      artifact: checksum,
      archive: `rollback/builds/${checksum}.tar`,
      verification: {
        marker: {
          path: "/__publication.json",
          sha256: archiveChecksum(bytes),
          size: bytes.length,
        },
      },
    },
  };
}

function fixture(
  mode = "production",
  uploadStdout = `\u001b[32mWorker Version ID:\u001b[39m \u001b[36m${candidateId}\u001b[39m\n`,
) {
  const directory = mkdtempSync(join(tmpdir(), "obsidian-cloudflare-"));
  const prior = archive(directory, mode, "e"),
    next = archive(directory, mode, "f"),
    objects = new Map([
      [prior.receipt.archive, prior.tar],
      [next.receipt.archive, next.tar],
    ]);
  let live = priorId,
    marker = prior.bytes,
    badPolicy = false,
    badHost = false,
    keepStagingIdentity = false,
    stagingServingOverride,
    lostDeploy = false,
    failedVerification = false,
    lostRollback = false;
  const writes = [],
    commands = [];
  const json = (result) =>
    new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  const config = {
    account,
    mode,
    worker,
    application: app,
    owner: "owner@example.com",
    serviceToken: service,
    team: "example.cloudflareaccess.com",
    hosts: ["staging.justindfuller.com"],
  };
  const transport = async (value, options = {}) => {
    const url = new URL(value);
    if (url.hostname === "api.cloudflare.com") {
      assert.equal(
        options.headers.Authorization,
        `Bearer ${url.pathname.includes("/access/") ? "access-read-token" : "deployment-token"}`,
      );
      const path = url.pathname;
      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        writes.push(body);
        if (mode === "staging" && stagingServingOverride)
          live = stagingServingOverride;
        else if (!keepStagingIdentity || mode !== "staging")
          live = body.versions[0].version_id;
        marker = prior.bytes;
        return json({ id: restoredId });
      }
      if (path.endsWith("/access/apps"))
        return json([
          {
            id: app,
            type: "self_hosted",
            destinations: [
              {
                type: mode === "preview" ? "preview_worker" : "worker",
                worker_id: worker,
              },
            ],
          },
        ]);
      if (path.endsWith("/policies"))
        return json([
          {
            decision: badPolicy ? "bypass" : "allow",
            include: [{ email: { email: config.owner } }],
          },
          {
            decision: "non_identity",
            include: [{ service_token: { token_id: service } }],
          },
        ]);
      if (path.endsWith("/service_tokens"))
        return json([
          {
            id: service,
            client_id: "access-client",
            expires_at: "2030-01-01T00:00:00Z",
          },
        ]);
      if (path.endsWith("/deployments/latest"))
        return json({
          id: live,
          urls: [
            `https://${live.slice(0, 8)}-justindfuller-site.justindfuller.workers.dev`,
          ],
        });
      if (path.endsWith("/previews/pr-403"))
        return json({
          urls: [
            badHost
              ? "https://attacker.example"
              : "https://pr-403-justindfuller-site.justindfuller.workers.dev",
          ],
        });
      if (path.endsWith("/deployments"))
        return json({
          deployments: [
            {
              id: restoredId,
              versions: [{ version_id: live, percentage: 100 }],
            },
          ],
        });
      return json({ id: worker });
    }
    if (
      mode !== "production" &&
      options.headers?.["CF-Access-Client-Secret"] !== "service-secret"
    )
      return new Response("denied", { status: 403 });
    assert.equal(url.pathname, "/__publication.json");
    return new Response(marker);
  };
  const execute = async (_command, args, options) => {
    commands.push({ args, purpose: options.purpose });
    if (options.purpose === "deploy") {
      assert.equal(options.token, "deployment-token");
      marker = readFileSync(join(directory, "dist/__publication.json"));
      const restoring = marker.equals(prior.bytes);
      if (mode !== "staging") live = restoring ? restoredId : candidateId;
      if ((restoring && lostRollback) || (!restoring && lostDeploy))
        throw new Error("private stdout canary");
      if (mode === "staging") return { stdout: uploadStdout };
    } else {
      assert.deepEqual(
        readFileSync(join(directory, "dist/__publication.json")),
        marker,
      );
      if (failedVerification && live === candidateId)
        throw new Error("private verifier canary");
    }
  };
  const store = {
    get: async (key) => objects.get(key),
    put: async (key, bytes) => {
      objects.set(key, bytes);
    },
  };
  const serving = new CloudflareServing({
    account,
    mode,
    pr: mode === "preview" ? 403 : undefined,
    token: "deployment-token",
    accessConfig: mode === "production" ? undefined : config,
    accessToken: "access-read-token",
    credentials: { clientId: "access-client", clientSecret: "service-secret" },
    store,
    bootstrapReceipt: prior.receipt,
    workspace: directory,
    transport,
    execute,
  });
  return {
    directory,
    serving,
    store,
    prior,
    next,
    writes,
    commands,
    live: () => live,
    badPolicy: () => {
      badPolicy = true;
    },
    badHost: () => {
      badHost = true;
    },
    keepStagingIdentity: () => {
      keepStagingIdentity = true;
    },
    serveStagingIdentity: (identity) => {
      stagingServingOverride = identity;
    },
    loseDeploy: () => {
      lostDeploy = true;
    },
    failVerification: () => {
      failedVerification = true;
    },
    loseRollback: () => {
      lostRollback = true;
    },
  };
}

test("Cloudflare production deploys the retained tested archive and restores the captured version at 100 percent", async () => {
  const f = fixture();
  try {
    await f.serving.verify(f.prior.receipt);
    const identity = await f.serving.deploy(f.next.receipt);
    assert.equal(identity, candidateId);
    await f.serving.verify({ ...f.next.receipt, deployment: identity });
    await f.serving.rollback(priorId, f.prior.receipt);
    await f.serving.verify(f.prior.receipt);
    assert.deepEqual(f.writes, [
      {
        strategy: "percentage",
        versions: [{ version_id: priorId, percentage: 100 }],
      },
    ]);
    assert.equal(f.commands.filter((c) => c.purpose === "verify").length, 6);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Cloudflare staging uploads a version before assigning 100 percent traffic", async () => {
  const f = fixture("staging");
  try {
    await f.serving.verify(f.prior.receipt);
    const identity = await f.serving.deploy(f.next.receipt);
    assert.equal(identity, candidateId);
    assert.deepEqual(
      f.commands.find((command) => command.purpose === "deploy").args,
      [
        "cf",
        "workers",
        "versions",
        "create",
        "--prebuilt",
        "--mode",
        "staging",
        "--message",
        f.next.receipt.artifact,
      ],
    );
    assert.deepEqual(f.writes, [
      {
        strategy: "percentage",
        versions: [{ version_id: candidateId, percentage: 100 }],
      },
    ]);
    assert.equal(f.serving.counters.deploymentAttempts, 1);
    assert.equal(f.serving.counters.deployments, 1);
    assert.equal(f.serving.counters.apiWrites, 1);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Cloudflare staging blocks traffic writes when upload output has invalid or ambiguous version IDs", async () => {
  for (const stdout of [
    "",
    "Worker Version ID: unknown\n",
    `Worker Version ID: ${candidateId}\nWorker Version ID: ${restoredId}\n`,
    `Worker Version ID: ${candidateId} extra\n`,
    `│  Worker Version ID: ${candidateId} extra\n`,
    `│  Worker Version ID: ${candidateId}\n│  Worker Version ID: ${restoredId}\n`,
    `prefix Worker Version ID: ${candidateId}\n`,
  ]) {
    const f = fixture("staging", stdout);
    try {
      await f.serving.verify(f.prior.receipt);
      await assert.rejects(
        f.serving.deploy(f.next.receipt),
        /staging version identity invalid/,
      );
      assert.equal(f.writes.length, 0);
      assert.equal(f.serving.counters.apiWrites, 0);
      assert.equal(f.live(), priorId);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
});

test("Cloudflare staging accepts the installed CLI box-framed version identity", async () => {
  for (const stdout of [
    `│  Worker Version ID: ${candidateId}\n`,
    `\u001b[32m│  Worker Version ID: ${candidateId} │\u001b[0m\r\n`,
  ]) {
    const f = fixture("staging", stdout);
    try {
      await f.serving.verify(f.prior.receipt);
      assert.equal(await f.serving.deploy(f.next.receipt), candidateId);
      assert.equal(f.writes.length, 1);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
});

test("Cloudflare staging reports an identity mismatch after traffic assignment", async () => {
  const f = fixture("staging");
  try {
    await f.serving.verify(f.prior.receipt);
    f.keepStagingIdentity();
    await assert.rejects(
      f.serving.deploy(f.next.receipt),
      /differs from uploaded staging version/,
    );
    assert.deepEqual(f.writes, [
      {
        strategy: "percentage",
        versions: [{ version_id: candidateId, percentage: 100 }],
      },
    ]);
    assert.equal(f.serving.counters.deploymentAttempts, 1);
    assert.equal(f.serving.counters.deployments, 1);
    assert.equal(f.live(), priorId);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Cloudflare staging rejects a serving version that differs from the uploaded version", async () => {
  const f = fixture("staging");
  try {
    await f.serving.verify(f.prior.receipt);
    f.serveStagingIdentity(restoredId);
    await assert.rejects(
      f.serving.deploy(f.next.receipt),
      /differs from uploaded staging version/,
    );
    assert.deepEqual(f.writes, [
      {
        strategy: "percentage",
        versions: [{ version_id: candidateId, percentage: 100 }],
      },
    ]);
    assert.equal(f.live(), restoredId);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Access policy and enabled URL checks block private uploads", async () => {
  for (const mode of ["staging", "preview"]) {
    const f = fixture(mode);
    try {
      await assert.rejects(f.serving.deploy(f.next.receipt), /Prior artifact/);
      await f.serving.verify(f.prior.receipt);
      f.badPolicy();
      await assert.rejects(
        f.serving.deploy(f.next.receipt),
        /unexpected identity/,
      );
      assert.equal(f.commands.filter((c) => c.purpose === "deploy").length, 0);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
  const f = fixture("preview");
  try {
    f.badHost();
    await assert.rejects(f.serving.metadata(), /Unexpected preview/);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("native preview response loss restores the exact prior archive with its new identity and accepted state", async () => {
  const f = fixture("preview"),
    tx = new PublicationTransaction(f.store, f.serving, "pr/403");
  const candidate = {
    source: "a".repeat(64),
    code: "b".repeat(64),
    digest: "c".repeat(64),
    state: { mode: "preview" },
    ...f.next.receipt,
  };
  delete candidate.deployment;
  try {
    f.loseDeploy();
    await assert.rejects(
      tx.publish(candidate, { bootstrap: true }),
      /restored and verified/,
    );
    assert.equal(f.live(), restoredId);
    assert.equal((await tx.read(tx.journalKey)).phase, "rolled_back");
    assert.equal(await tx.read(tx.currentKey), undefined);
    assert.equal(f.writes.length, 0);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("lost preview rollback response remains an incident until exact archive verification recovers it", async () => {
  const f = fixture("preview"),
    tx = new PublicationTransaction(f.store, f.serving, "pr/403");
  const candidate = {
    source: "a".repeat(64),
    code: "b".repeat(64),
    digest: "c".repeat(64),
    state: { mode: "preview" },
    ...f.next.receipt,
  };
  delete candidate.deployment;
  try {
    f.failVerification();
    f.loseRollback();
    await assert.rejects(
      tx.publish(candidate, { bootstrap: true }),
      /rollback is unverified/,
    );
    assert.equal((await tx.read(tx.journalKey)).phase, "incident");
    await new PublicationTransaction(f.store, f.serving, "pr/403").reconcile();
    assert.equal((await tx.read(tx.journalKey)).phase, "rolled_back");
    assert.equal(f.live(), restoredId);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("artifact account and production/private routing boundaries are validated before deployment", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        validateDeploymentArchive(f.next.tar, f.next.receipt.artifact, {
          account,
          mode: "staging",
        }),
      /target boundary/,
    );
    assert.throws(
      () =>
        validateDeploymentArchive(f.next.tar, f.next.receipt.artifact, {
          account: "f".repeat(32),
          mode: "production",
        }),
      /target boundary/,
    );
    assert.throws(
      () =>
        validateDeploymentArchive(f.next.tar, "0".repeat(64), {
          account,
          mode: "production",
        }),
      /checksum/,
    );
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
