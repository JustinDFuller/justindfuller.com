import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const source = "a".repeat(64);

async function loadPublisher(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "publisher-main-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "obsidian-test-host",
        setup(builder) {
          builder.onResolve({ filter: /^obsidian$/ }, () => ({
            path: "obsidian",
            namespace: "obsidian-test-host",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "obsidian-test-host" },
            () => ({
              loader: "js",
              contents: `
                export class Plugin { constructor(app, manifest) { this.app = app; this.manifest = manifest; } }
                export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
                export class Setting {}
                export class Modal {}
                export class FileSystemAdapter {}
                export class Notice { constructor(message) { globalThis.__publisherTestNotices.push(message); } }
              `,
            }),
          );
          builder.onResolve({ filter: /^\.\/(keychain|s3)\.ts$/ }, (args) => ({
            path: args.path.slice(2),
            namespace: "publisher-test-host",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "publisher-test-host" },
            (args) => ({
              loader: "js",
              contents:
                args.path === "keychain.ts"
                  ? "export class MacKeychain { constructor() { throw new Error('Test must inject a keychain'); } }"
                  : `
                    import { createHash } from 'node:crypto';
                    const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
                    export function verifyMetadata() {}
                    export class SdkS3Transport {
                      constructor() {}
                      async head(target, key) {
                        const bytes = globalThis.__publisherTestObjects?.get(key);
                        return bytes ? { contentLength: bytes.byteLength, metadata: { sha256: hash(bytes), md5: hash(bytes, 'md5') } } : undefined;
                      }
                      async get(target, key) { return globalThis.__publisherTestObjects?.get(key); }
                      close() {}
                    }
                  `,
            }),
          );
        },
      },
    ],
  });
  const bundlePath = join(directory, "main.cjs");
  await writeFile(bundlePath, result.outputFiles[0].contents);
  const require = createRequire(import.meta.url);
  return require(bundlePath).default as new (
    app: object,
    manifest: { id: string },
  ) => {
    settings: { accountId: string; stateBucket: string };
    keychain: { read(kind: string): Promise<unknown> };
    runtime: {
      scheduler: { revision: string };
      notices: Record<string, string[]>;
      publication: Record<string, { source: string; status: string }>;
      reportUnavailable?: Record<string, boolean>;
    };
    statusRunning: boolean;
    persist(): Promise<void>;
    readReports(manual?: boolean): Promise<void>;
  };
}

function publicationState() {
  return {
    version: 1 as const,
    scheduler: { revision: source },
    notices: {},
    publication: {
      staging: { source, status: "verified" },
      production: { source, status: "failed" },
    },
  };
}

test("report setup failures mark both targets unavailable and persist failures stay handled", async (t) => {
  const PluginClass = await loadPublisher(t),
    notices: string[] = [],
    testGlobal = globalThis as typeof globalThis & {
      __publisherTestNotices?: string[];
    };
  testGlobal.__publisherTestNotices = notices;
  t.after(() => delete testGlobal.__publisherTestNotices);
  const plugin = new PluginClass({}, { id: "test-publisher" });
  plugin.settings = {
    ...plugin.settings,
    stateBucket: "justindfuller-obsidian-source",
  };
  plugin.keychain = {
    read: async () => ({
      accessKeyId: "local-test-only",
      secretAccessKey: "local-test-only",
    }),
  };
  plugin.runtime = publicationState();
  let saves = 0;
  plugin.persist = async () => {
    saves++;
    throw new Error("simulated local state write failure");
  };

  await assert.doesNotReject(plugin.readReports(true));
  assert.deepEqual(plugin.runtime.publication, publicationState().publication);
  assert.deepEqual(plugin.runtime.reportUnavailable, {
    staging: true,
    production: true,
  });
  assert.equal(plugin.statusRunning, false);
  assert.ok(
    notices.includes("staging: protected publication status is unavailable"),
  );
  assert.ok(
    notices.includes("production: protected publication status is unavailable"),
  );
  assert.ok(
    notices.includes(
      "staging: status unavailable; production: status unavailable",
    ),
  );
  assert.equal(saves, 2);

  notices.length = 0;
  await assert.doesNotReject(plugin.readReports(true));
  assert.equal(
    notices.filter((message) =>
      message.endsWith("protected publication status is unavailable"),
    ).length,
    0,
  );
  assert.equal(saves, 2);
});

test("missing report credentials mark both targets unavailable and retain the configuration notice", async (t) => {
  const PluginClass = await loadPublisher(t),
    notices: string[] = [],
    testGlobal = globalThis as typeof globalThis & {
      __publisherTestNotices?: string[];
    };
  testGlobal.__publisherTestNotices = notices;
  t.after(() => delete testGlobal.__publisherTestNotices);
  const plugin = new PluginClass({}, { id: "test-publisher" });
  plugin.settings = {
    ...plugin.settings,
    stateBucket: "justindfuller-obsidian-state",
  };
  plugin.keychain = { read: async () => undefined };
  plugin.runtime = publicationState();
  plugin.persist = async () => {
    throw new Error("simulated local state write failure");
  };

  await assert.doesNotReject(plugin.readReports(true));
  assert.deepEqual(plugin.runtime.publication, publicationState().publication);
  assert.deepEqual(plugin.runtime.reportUnavailable, {
    staging: true,
    production: true,
  });
  assert.equal(plugin.statusRunning, false);
  assert.ok(
    notices.includes(
      "Configure the protected report credential to check publication status",
    ),
  );
  assert.ok(
    notices.includes("staging: protected publication status is unavailable"),
  );
  assert.ok(
    notices.includes("production: protected publication status is unavailable"),
  );
});

test("report recovery clears availability per target only after that target reads successfully", async (t) => {
  const PluginClass = await loadPublisher(t),
    notices: string[] = [],
    testGlobal = globalThis as typeof globalThis & {
      __publisherTestNotices?: string[];
      __publisherTestObjects?: Map<string, Uint8Array>;
    },
    objects = new Map<string, Uint8Array>();
  testGlobal.__publisherTestNotices = notices;
  testGlobal.__publisherTestObjects = objects;
  t.after(() => {
    delete testGlobal.__publisherTestNotices;
    delete testGlobal.__publisherTestObjects;
  });
  const plugin = new PluginClass({}, { id: "test-publisher" });
  plugin.settings = {
    ...plugin.settings,
    stateBucket: "justindfuller-obsidian-state",
  };
  plugin.keychain = {
    read: async () => ({
      accessKeyId: "local-test-only",
      secretAccessKey: "local-test-only",
    }),
  };
  plugin.runtime = publicationState();
  plugin.runtime.reportUnavailable = { staging: true, production: true };
  plugin.persist = async () => {};
  const reportBytes = (target: "staging" | "production") =>
    Buffer.from(
      JSON.stringify({
        version: 1,
        target,
        source,
        status: "verified",
        issues: [],
      }),
    );

  objects.set("reports/staging.json", reportBytes("staging"));
  await plugin.readReports();
  assert.deepEqual(plugin.runtime.reportUnavailable, {
    staging: false,
    production: true,
  });
  assert.equal(plugin.runtime.publication.staging.status, "verified");
  assert.equal(plugin.runtime.publication.production.status, "failed");

  objects.delete("reports/staging.json");
  objects.set("reports/production.json", reportBytes("production"));
  await plugin.readReports();
  assert.deepEqual(plugin.runtime.reportUnavailable, {
    staging: true,
    production: false,
  });
  assert.equal(plugin.runtime.publication.production.status, "verified");

  objects.set("reports/staging.json", reportBytes("staging"));
  objects.delete("reports/production.json");
  await plugin.readReports();
  assert.deepEqual(plugin.runtime.reportUnavailable, {
    staging: false,
    production: true,
  });
  assert.equal(plugin.runtime.publication.staging.status, "verified");
  assert.equal(plugin.runtime.publication.production.status, "verified");
});
