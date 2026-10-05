import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { publicationNotices } from "../tools/obsidian-image-publisher/src/status.ts";
import {
  publicPublicationReceipt,
  protectedPublicationReport,
  recordPublication,
} from "./record-obsidian-publication.mjs";

const candidate = {
  source: "a".repeat(64),
  code: "b".repeat(64),
  codeSha: "c".repeat(40),
  digest: "d".repeat(64),
  state: {
    mode: "staging",
    files: { "private-canary.md": "raw state body canary" },
  },
  privateTitle: "private title canary",
  credential: "credential canary",
};
const result = {
  skipped: false,
  accepted: {
    receipt: {
      artifact: "e".repeat(64),
      deployment: "11111111-1111-1111-1111-111111111111",
      verification: { prepared: candidate.state },
    },
  },
};
const diagnostics = {
  version: 1,
  mode: "staging",
  source: candidate.source,
  digest: candidate.digest,
  files: [
    {
      path: "private-canary.md",
      revision: "f".repeat(64),
      slug: "private-canary",
      environment: "nonprod",
      sync: "add",
      draft: false,
      body: "raw state body canary",
    },
  ],
  masks: [],
  issues: [
    {
      key: "f".repeat(64),
      category: "invalid_metadata",
      path: "private-canary.md",
      message: "raw state body canary",
      reference: "credential canary",
    },
  ],
  rawMarkdown: "raw state body canary",
  credential: "credential canary",
};

test("public receipts whitelist correlation and counters without copying private state or diagnostics", () => {
  const receipt = publicPublicationReceipt(
    candidate,
    result,
    "staging",
    123,
    {
      state: { puts: 2, credential: "credential canary" },
      worker: { verifications: 3 },
    },
    "123-1",
  );
  const bytes = JSON.stringify(receipt);
  for (const privateValue of [
    "private-canary",
    "raw state body canary",
    "private title canary",
    "credential canary",
    '"verification"',
    "prepared",
  ])
    assert.equal(bytes.includes(privateValue), false);
  assert.equal(receipt.counters.state.puts, 2);
  assert.equal(receipt.counters.worker.verifications, 3);
  assert.equal(receipt.policyVersion, 1);
  assert.equal(receipt.codeSha, candidate.codeSha);
  assert.equal(receipt.deployment, result.accepted.receipt.deployment);
  assert.throws(
    () =>
      publicPublicationReceipt(
        candidate,
        result,
        "staging",
        1,
        { worker: { apiReads: -1 } },
        "123-1",
      ),
    /counter/,
  );
  assert.throws(
    () =>
      publicPublicationReceipt(
        candidate,
        result,
        "../production",
        1,
        {},
        "123-1",
      ),
    /correlation/,
  );
});

test("protected reports preserve ownership and issues while omitting post bodies and credentials", () => {
  const receipt = publicPublicationReceipt(
    candidate,
    result,
    "staging",
    1,
    {},
    "123-1",
  );
  const report = protectedPublicationReport(
      candidate,
      "staging",
      "degraded",
      diagnostics,
      {
        ...receipt,
        verification: candidate.state,
        credential: "credential canary",
      },
    ),
    bytes = JSON.stringify(report);
  assert.equal(report.files[0].path, "private-canary.md");
  assert.equal(report.files[0].environment, "nonprod");
  assert.equal(report.issues[0].category, "invalid_metadata");
  assert.equal(report.receipt.verifiedAt, receipt.verifiedAt);
  assert.throws(
    () =>
      protectedPublicationReport(
        candidate,
        "staging",
        "verified",
        diagnostics,
        { ...receipt, verifiedAt: undefined },
      ),
    /timestamp/,
  );
  for (const privateValue of [
    "raw state body canary",
    "credential canary",
    "rawMarkdown",
    "privateTitle",
  ])
    assert.equal(bytes.includes(privateValue), false);
  assert.throws(
    () =>
      protectedPublicationReport(candidate, "staging", "verified", {
        ...diagnostics,
        source: "0".repeat(64),
      }),
    /correlation/,
  );
  assert.throws(
    () =>
      protectedPublicationReport(candidate, "staging", "verified", {
        ...diagnostics,
        mode: "production",
      }),
    /correlation/,
  );
  assert.throws(
    () =>
      protectedPublicationReport(candidate, "staging", "unknown", diagnostics),
    /correlation/,
  );
});

test("report status follows the transaction and successful staging never clears a failed production report", async () => {
  for (const fails of [false, true]) {
    const objects = new Map([
        [
          "reports/production.json",
          Buffer.from(
            JSON.stringify({ status: "failed", source: candidate.source }),
          ),
        ],
      ]),
      statuses = [];
    const store = {
      counters: {},
      get: async (key) => objects.get(key),
      put: async (key, bytes) => {
        objects.set(key, bytes);
        if (key === "reports/staging.json")
          statuses.push(JSON.parse(bytes).status);
      },
    };
    let live = "11111111-1111-1111-1111-111111111111";
    const serving = {
      counters: {},
      identity: async () => live,
      capture: async () => ({
        deployment: live,
        artifact: "f".repeat(64),
        archive: "rollback/prior.tar",
        verification: {},
      }),
      deploy: async () => {
        live = "22222222-2222-2222-2222-222222222222";
        return live;
      },
      verify: async (receipt) => {
        assert.equal(receipt.deployment, live);
        if (fails && live.startsWith("222"))
          throw new Error("private diagnostic canary");
      },
      rollback: async (identity) => {
        live = identity;
      },
    };
    const publication = {
      ...candidate,
      artifact: "e".repeat(64),
      archive: "rollback/tested.tar",
      verification: {},
    };
    if (fails)
      await assert.rejects(
        recordPublication(publication, diagnostics, {
          store,
          serving,
          namespace: "staging",
          bootstrap: true,
        }),
        /protected target report/,
      );
    else
      await recordPublication(publication, diagnostics, {
        store,
        serving,
        namespace: "staging",
        bootstrap: true,
      });
    assert.deepEqual(
      statuses,
      fails ? ["queued", "failed"] : ["queued", "degraded"],
    );
    assert.equal(
      JSON.parse(objects.get("reports/production.json")).status,
      "failed",
    );
    const output = JSON.parse(objects.get("reports/staging.json"));
    assert.equal(
      JSON.stringify(output).includes("raw state body canary"),
      false,
    );
    assert.equal(JSON.stringify(output).includes("credential canary"), false);
    assert.equal(output.status, fails ? "failed" : "degraded");
  }
});

test("a full issue report still records deployment failure without losing existing diagnostics", async () => {
  const full = {
    ...diagnostics,
    issues: Array.from({ length: 10000 }, (_, index) => ({
      key: createHash("sha256").update(String(index)).digest("hex"),
      category: "invalid_metadata",
    })),
  };
  const statuses = [];
  const store = {
    get: async () => undefined,
    put: async (key, bytes) => {
      if (key === "reports/staging.json") statuses.push(JSON.parse(bytes));
    },
  };
  await assert.rejects(
    recordPublication(candidate, full, {
      store,
      serving: {
        identity: async () => {
          throw new Error("unavailable");
        },
      },
      namespace: "staging",
    }),
    /protected target report/,
  );
  assert.deepEqual(
    statuses.map((report) => report.status),
    ["queued", "failed"],
  );
  assert.deepEqual(statuses[1].issues, full.issues);
});

test("Go composite issue identities become stable opaque fingerprints accepted by the publisher", () => {
  const key = `private-canary.md:${"a".repeat(64)}:invalid_metadata`;
  const report = protectedPublicationReport(candidate, "staging", "degraded", {
    ...diagnostics,
    issues: [{ key, category: "invalid_metadata" }],
  });
  assert.equal(
    report.issues[0].key,
    createHash("sha256").update(key).digest("hex"),
  );
  assert.equal(report.issues[0].key.includes("private-canary"), false);
  const first = publicationNotices(report, {});
  assert.deepEqual(first.notices, ["staging: invalid_metadata"]);
  assert.deepEqual(publicationNotices(report, first.state).notices, []);
});
