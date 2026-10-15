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
                export class Modal {
                  constructor(app) {
                    this.app = app;
                    this.lines = [];
                    this.contentEl = {
                      createEl: (tag, options) => { this.lines.push(options?.text ?? ''); return {}; },
                      empty: () => { this.lines.length = 0; },
                    };
                  }
                  open() { globalThis.__publisherTestModals?.push(this); this.onOpen(); }
                  close() { this.onClose(); }
                }
                export class FileSystemAdapter {}
                export class Notice {
                  constructor(message, duration) {
                    this.message = message;
                    this.duration = duration;
                    this.hidden = false;
                    this.listeners = [];
                    const element = { addEventListener: (type, listener) => this.listeners.push(listener) };
                    if (globalThis.__publisherTestLegacyNotice) this.noticeEl = element;
                    else this.containerEl = element;
                    globalThis.__publisherTestNotices.push(message);
                    globalThis.__publisherTestNoticeObjects?.push(this);
                  }
                  hide() { this.hidden = true; }
                  click() { for (const listener of this.listeners) listener(); }
                }
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
      unresolved?: Record<
        string,
        { key: string; dismissed: boolean; reason: string; path: string }[]
      >;
    };
    statusItem?: {
      text: string;
      style: { display: string };
      onclick?: () => void;
      setText(text: string): void;
    };
    statusRunning: boolean;
    renderIssues(): void;
    showIssues(): void;
    onunload(): void;
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

type TestNotice = {
  message: string;
  duration: number;
  hidden: boolean;
  click(): void;
};
type TestModal = { lines: string[] };
const invalid = "environment must be one of nonprod, staging, production";

async function issueHarness(t: TestContext) {
  const PluginClass = await loadPublisher(t),
    notices: string[] = [],
    noticeObjects: TestNotice[] = [],
    modals: TestModal[] = [],
    objects = new Map<string, Uint8Array>(),
    testGlobal = globalThis as typeof globalThis & {
      __publisherTestNotices?: string[];
      __publisherTestNoticeObjects?: TestNotice[];
      __publisherTestModals?: TestModal[];
      __publisherTestObjects?: Map<string, Uint8Array>;
    };
  testGlobal.__publisherTestNotices = notices;
  testGlobal.__publisherTestNoticeObjects = noticeObjects;
  testGlobal.__publisherTestModals = modals;
  testGlobal.__publisherTestObjects = objects;
  t.after(() => {
    delete testGlobal.__publisherTestNotices;
    delete testGlobal.__publisherTestNoticeObjects;
    delete testGlobal.__publisherTestModals;
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
  plugin.runtime.publication = {};
  let saves = 0;
  plugin.persist = async () => {
    saves++;
  };
  plugin.statusItem = {
    text: "",
    style: { display: "" },
    setText(text: string) {
      this.text = text;
    },
  };
  const publish = (
    target: "staging" | "production",
    issues: object[],
    status = issues.length ? "degraded" : "verified",
  ) =>
    objects.set(
      `reports/${target}.json`,
      Buffer.from(
        JSON.stringify({ version: 1, target, source, status, issues }),
      ),
    );
  const rejection = (letter: string, reason: string | undefined = invalid) => ({
    key: letter.repeat(64),
    category: "markdown_metadata",
    path: "Blog/throwaway.md",
    ...(reason ? { reason } : {}),
  });
  plugin.statusItem.onclick = () => plugin.showIssues();
  const open = () =>
    noticeObjects.filter((notice) => notice.duration === 0 && !notice.hidden);
  return {
    plugin,
    notices,
    get noticeObjects() {
      return noticeObjects.filter((notice) => notice.duration === 0);
    },
    modals,
    publish,
    rejection,
    open,
    saves: () => saves,
  };
}

test("a rejected edit shows a persistent notice naming the note, reason and target that survives later polls without repeating", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);
  const [notice] = h.open();
  assert.equal(notice.duration, 0);
  assert.ok(notice.message.includes("Blog/throwaway.md"));
  assert.ok(notice.message.includes(invalid));
  assert.ok(notice.message.endsWith("previous version on staging."));
  assert.equal(h.plugin.statusItem?.text, "1 publication issue");
  assert.equal(h.plugin.statusItem?.style.display, "");
  assert.equal(h.notices.includes("staging: markdown_metadata"), false);

  await h.plugin.readReports();
  await h.plugin.readReports();
  assert.equal(h.noticeObjects.length, 1);
  assert.equal(h.open().length, 1);
  assert.equal(
    h.notices.filter((message) => message.includes("Blog/throwaway.md")).length,
    1,
  );
  assert.equal(h.plugin.statusItem?.text, "1 publication issue");
});

test("a fixed note clears the notice and status bar item and reports publication recovered", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);
  h.publish("staging", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 0);
  assert.equal(h.noticeObjects[0].hidden, true);
  assert.equal(h.plugin.statusItem?.style.display, "none");
  assert.equal(h.plugin.statusItem?.text, "0 publication issues");
  assert.ok(h.notices.includes("staging: publication recovered"));
  assert.deepEqual(h.plugin.runtime.unresolved?.staging, []);
});

test("the same rejection in both targets shows one notice naming both and a count of one", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", [h.rejection("b")]);
  await h.plugin.readReports();
  assert.equal(h.noticeObjects.length, 2);
  const [notice] = h.open();
  assert.equal(h.open().length, 1);
  assert.ok(notice.message.includes("staging and production"));
  assert.equal(h.plugin.statusItem?.text, "1 publication issue");
  h.publish("production", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);
  assert.ok(h.open()[0].message.endsWith("previous version on staging."));
});

test("distinct issues each get a notice and the status bar counts them all", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [
    h.rejection("a"),
    { ...h.rejection("b"), path: "Blog/other.md", reason: "bad route" },
  ]);
  h.publish("production", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 2);
  assert.equal(h.plugin.statusItem?.text, "2 publication issues");
});

test("dismissing a notice hides it, keeps the count, and does not return while the fingerprint is unchanged", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", []);
  await h.plugin.readReports();
  const saved = h.saves();
  h.open()[0].click();
  assert.equal(h.plugin.runtime.unresolved?.staging?.[0].dismissed, true);
  assert.ok(h.saves() > saved);
  assert.equal(h.plugin.statusItem?.text, "1 publication issue");
  await h.plugin.readReports();
  await h.plugin.readReports();
  assert.equal(h.noticeObjects.length, 1);
  assert.equal(h.open().length, 0);
  assert.equal(h.plugin.statusItem?.style.display, "");

  h.publish("staging", [h.rejection("a", "environment must not be blank")]);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);

  h.publish("staging", []);
  await h.plugin.readReports();
  h.publish("staging", [h.rejection("a", "environment must not be blank")]);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);
});

test("the status bar item reopens the details, including dismissed issues", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", []);
  await h.plugin.readReports();
  h.open()[0].click();
  h.plugin.statusItem?.onclick?.();
  assert.equal(h.modals.length, 1);
  assert.deepEqual(h.modals[0].lines, [
    "Publication issues",
    `Blog/throwaway.md: ${invalid}. Still serving the previous version on staging.`,
  ]);
});

test("the details view says so when nothing is unresolved", async (t) => {
  const h = await issueHarness(t);
  h.plugin.renderIssues();
  assert.equal(h.plugin.statusItem?.style.display, "none");
  h.plugin.statusItem?.onclick?.();
  assert.deepEqual(h.modals[0].lines, [
    "Publication issues",
    "No unresolved publication issues.",
  ]);
});

test("a report without a reason falls back to the category text", async (t) => {
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a", "")]);
  h.publish("production", []);
  await h.plugin.readReports();
  assert.ok(h.open()[0].message.includes("markdown metadata"));
});

test("unresolved issues saved before a restart show their notices again and unloading hides them", async (t) => {
  const h = await issueHarness(t);
  h.plugin.runtime.unresolved = {
    staging: [
      {
        key: "a".repeat(64),
        path: "Blog/throwaway.md",
        reason: invalid,
        dismissed: false,
        category: "markdown_metadata",
      } as never,
      {
        key: "b".repeat(64),
        path: "Blog/dismissed.md",
        reason: invalid,
        dismissed: true,
        category: "markdown_metadata",
      } as never,
    ],
  };
  h.plugin.renderIssues();
  assert.equal(h.open().length, 1);
  assert.equal(h.plugin.statusItem?.text, "2 publication issues");
  h.plugin.renderIssues();
  assert.equal(h.noticeObjects.length, 1);
  h.plugin.onunload();
  assert.equal(h.open().length, 0);
});

test("older Obsidian versions without a notice container still dismiss through the notice element", async (t) => {
  (
    globalThis as { __publisherTestLegacyNotice?: boolean }
  ).__publisherTestLegacyNotice = true;
  t.after(() => {
    delete (globalThis as { __publisherTestLegacyNotice?: boolean })
      .__publisherTestLegacyNotice;
  });
  const h = await issueHarness(t);
  h.publish("staging", [h.rejection("a")]);
  h.publish("production", []);
  await h.plugin.readReports();
  assert.equal(h.open().length, 1);
  h.open()[0].click();
  assert.equal(h.open().length, 0);
  assert.equal(h.plugin.runtime.unresolved?.staging?.[0].dismissed, true);
});
