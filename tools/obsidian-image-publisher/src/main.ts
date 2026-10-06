import {
  Plugin,
  PluginSettingTab,
  Setting,
  Modal,
  Notice,
  FileSystemAdapter,
  type App,
  type TAbstractFile,
} from "obsidian";
import { join } from "node:path";
import { MacKeychain, type CredentialKind } from "./keychain.ts";
import { writeRuntimeState } from "./runtime.ts";
import { SdkS3Transport, type S3Target } from "./s3.ts";
import {
  publishSnapshot,
  type PublishResult,
  type VaultSource,
} from "./content.ts";
import {
  PublisherScheduler,
  ProviderError,
  type SchedulerState,
} from "./scheduler.ts";
import { dispatchContent } from "./dispatch.ts";
import {
  observePublication,
  queuedPublication,
  readPublicationReport,
  readPublicationReports,
  publicationStatusSummary,
  type NoticeState,
  type PublicationStatusState,
} from "./status.ts";
import { PrivateR2Store } from "./publication.ts";

type Settings = {
  accountId: string;
  sourceBucket: string;
  stateBucket: string;
  sourceFolder: string;
  automatic: boolean;
};
type RuntimeState = {
  version: 1;
  scheduler: SchedulerState;
  previous?: PublishResult;
  notices: NoticeState;
  verified?: Record<string, string>;
  publication?: PublicationStatusState;
  reportUnavailable?: Partial<Record<"staging" | "production", boolean>>;
};
const defaults: Settings = {
  accountId: "9dce34804a27754a4ea66a5789827dfa",
  sourceBucket: "justindfuller-obsidian-source",
  stateBucket: "justindfuller-obsidian-state",
  sourceFolder: "",
  automatic: false,
};

export default class CloudflarePublisher extends Plugin {
  settings: Settings = { ...defaults };
  keychain!: MacKeychain;
  private scheduler!: PublisherScheduler;
  private runtime: RuntimeState = { version: 1, scheduler: {}, notices: {} };
  private statusRunning = false;
  private statusAt = 0;
  private previousNotice = "";
  private persistQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    if (process.platform !== "darwin") {
      new Notice("Cloudflare publishing requires macOS");
      return;
    }
    const stored = (await this.loadData()) as Partial<Settings> | undefined;
    for (const key of [
      "accountId",
      "sourceBucket",
      "stateBucket",
      "sourceFolder",
    ] as const)
      if (typeof stored?.[key] === "string") this.settings[key] = stored[key];
    this.settings.automatic = stored?.automatic === true;
    this.keychain = new MacKeychain(this.app, this.manifest.id);
    try {
      if (await this.app.vault.adapter.exists(this.runtimePath())) {
        const state = JSON.parse(
          await this.app.vault.adapter.read(this.runtimePath()),
        ) as RuntimeState;
        if (state.version !== 1 || !state.scheduler || !state.notices)
          throw new Error("Invalid local state");
        this.runtime = state;
      }
    } catch {
      this.settings.automatic = false;
      this.notify(
        "Publisher state needs attention; automatic publishing is paused",
      );
    }
    this.scheduler = new PublisherScheduler(this.runtime.scheduler, {
      now: () => Date.now(),
      upload: () => this.upload(),
      dispatch: async (revision) => {
        const token = await this.keychain.read("dispatch");
        if (!token) throw new ProviderError(401);
        await dispatchContent(token, revision);
      },
      persist: async (state) => {
        this.runtime.scheduler = state;
        await this.persist();
      },
      recovered: (revision) => this.recoveredPublication(revision),
      notice: (status) => {
        if (
          (status === "uploaded" || status === "queued") &&
          this.runtime.scheduler.revision
        ) {
          this.runtime.publication = queuedPublication(
            this.runtime.scheduler.revision,
            status,
            this.runtime.publication ?? {},
          );
          void this.persist().catch(() =>
            this.notify("Publication status could not be saved"),
          );
        }
        this.notify(
          {
            uploaded: "Private source uploaded; deployment pending",
            queued: "Deployment queued; awaiting verification",
            upload_failed: "Private upload failed; retry pending",
            dispatch_failed: "Deployment dispatch failed; retry pending",
            authentication_required:
              "Replace the dispatch credential, then publish manually",
          }[status],
        );
      },
    });
    this.addSettingTab(new PublisherSettings(this.app, this));
    this.addCommand({
      id: "publish-content",
      name: "Publish content to Cloudflare",
      callback: () => {
        void this.scheduler
          .manual()
          .catch(() =>
            this.notify("Publishing failed; private source remains available"),
          );
      },
    });
    this.addCommand({
      id: "check-publication",
      name: "Check publication status",
      callback: () => {
        void this.readReports(true);
      },
    });
    const changed = (file: TAbstractFile) => {
      if (this.includes(file.path)) this.scheduler.edited();
    };
    this.registerEvent(this.app.vault.on("create", changed));
    this.registerEvent(this.app.vault.on("modify", changed));
    this.registerEvent(this.app.vault.on("delete", changed));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (this.includes(file.path) || this.includes(oldPath))
          this.scheduler.edited();
      }),
    );
    this.registerInterval(
      window.setInterval(() => {
        if (this.settings.automatic)
          void this.scheduler
            .tick()
            .catch(() => this.notify("Publishing retry could not be saved"));
        if (Date.now() >= this.statusAt) void this.readReports();
      }, 1000),
    );
  }

  private runtimePath(): string {
    return join(
      this.app.vault.configDir,
      "plugins",
      this.manifest.id,
      "publisher-state.json",
    );
  }
  private async persist(): Promise<void> {
    if (!(this.app.vault.adapter instanceof FileSystemAdapter))
      throw new Error("Publishing state requires a local vault");
    const path = join(this.app.vault.adapter.getBasePath(), this.runtimePath());
    const body = JSON.stringify(this.runtime);
    const operation = this.persistQueue
      .catch(() => {})
      .then(() => writeRuntimeState(path, body));
    this.persistQueue = operation;
    await operation;
  }
  private includes(path: string): boolean {
    const folder = this.settings.sourceFolder.replace(/^\/+|\/+$/g, "");
    return folder === "" || path.startsWith(`${folder}/`);
  }
  private target(bucket: string): S3Target {
    if (
      !/^[a-f0-9]{32}$/.test(this.settings.accountId) ||
      !/^[a-z0-9-]{3,63}$/.test(bucket)
    )
      throw new Error("Invalid R2 destination");
    return {
      id: bucket,
      bucket,
      region: "auto",
      endpoint: `https://${this.settings.accountId}.r2.cloudflarestorage.com`,
    };
  }
  private async upload(): Promise<PublishResult> {
    const credentials = await this.keychain.read("upload");
    if (!credentials) throw new Error("Configure the upload credential");
    const folder = this.settings.sourceFolder.replace(/^\/+|\/+$/g, "");
    if (
      folder.split("/").some((part) => part === ".." || part === ".") ||
      folder.includes("\\")
    )
      throw new Error("Invalid source folder");
    const source: VaultSource = {
      paths: async () =>
        this.app.vault
          .getFiles()
          .filter((file) => this.includes(file.path))
          .map(
            (file) =>
              `Blog/${folder ? file.path.slice(folder.length + 1) : file.path}`,
          ),
      read: async (path) =>
        new Uint8Array(
          await this.app.vault.adapter.readBinary(
            `${folder ? `${folder}/` : ""}${path.slice(5)}`,
          ),
        ),
    };
    const transport = new SdkS3Transport(credentials);
    try {
      const result = await publishSnapshot(
        source,
        transport,
        this.target(this.settings.sourceBucket),
        this.runtime.previous,
      );
      this.runtime.previous = result;
      return result;
    } finally {
      transport.close();
    }
  }
  private async readReports(manual = false): Promise<void> {
    if (this.statusRunning) {
      if (manual) new Notice("A publication status check is already running");
      return;
    }
    this.statusRunning = true;
    this.statusAt = Date.now() + 60000;
    let transport: SdkS3Transport | undefined;
    try {
      const credentials = await this.keychain.read("reports");
      if (!credentials) {
        this.statusAt = Date.now() + 300000;
        if (manual)
          new Notice(
            "Configure the protected report credential to check publication status",
          );
        return;
      }
      transport = new SdkS3Transport(credentials);
      const store = new PrivateR2Store(
        transport,
        this.target(this.settings.stateBucket),
      );
      await readPublicationReports(
        store,
        async (target, report) => {
          const result = observePublication(
            report,
            this.runtime.scheduler.revision,
            this.runtime.publication ?? {},
            this.runtime.notices,
          );
          this.runtime.notices = result.issues;
          this.runtime.publication = result.status;
          const wasUnavailable = this.runtime.reportUnavailable?.[target];
          this.runtime.reportUnavailable ??= {};
          this.runtime.reportUnavailable[target] = false;
          await this.persist();
          if (wasUnavailable)
            this.notify(`${target}: protected publication status is available`);
          for (const notice of result.notices) this.notify(notice);
        },
        async (target) => {
          this.runtime.reportUnavailable ??= {};
          if (!this.runtime.reportUnavailable[target]) {
            this.runtime.reportUnavailable[target] = true;
            await this.persist();
            this.notify(
              `${target}: protected publication status is unavailable`,
            );
          }
        },
      );
    } catch {
      this.notify("Protected publication status is unavailable");
    } finally {
      transport?.close();
      this.statusRunning = false;
      if (manual && transport)
        new Notice(
          publicationStatusSummary(
            this.runtime.publication ?? {},
            this.runtime.reportUnavailable,
          ),
        );
    }
  }
  private async recoveredPublication(revision: string): Promise<boolean> {
    let transport: SdkS3Transport | undefined;
    try {
      const credentials = await this.keychain.read("reports");
      if (!credentials) return false;
      transport = new SdkS3Transport(credentials);
      const store = new PrivateR2Store(
        transport,
        this.target(this.settings.stateBucket),
      );
      for (const target of ["staging", "production"] as const) {
        const report = await readPublicationReport(store, target);
        if (
          report.target !== target ||
          report.source !== revision ||
          !["verified", "degraded"].includes(report.status)
        )
          return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      transport?.close();
    }
  }
  private notify(message: string): void {
    if (message !== this.previousNotice) {
      new Notice(message);
      this.previousNotice = message;
    }
  }
}

class PublisherSettings extends PluginSettingTab {
  private plugin: CloudflarePublisher;
  constructor(app: App, plugin: CloudflarePublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    this.containerEl.empty();
    for (const [key, name] of [
      ["accountId", "Cloudflare account ID"],
      ["sourceBucket", "Private source bucket"],
      ["stateBucket", "Protected report bucket"],
      ["sourceFolder", "Source folder (blank for vault root)"],
    ] as const) {
      new Setting(this.containerEl).setName(name).addText((text) =>
        text.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveData(this.plugin.settings);
        }),
      );
    }
    new Setting(this.containerEl)
      .setName("Automatic publishing")
      .setDesc(
        "Enable after manual staging and production verification succeeds.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.automatic)
          .onChange(async (value) => {
            this.plugin.settings.automatic = value;
            await this.plugin.saveData(this.plugin.settings);
          }),
      );
    for (const kind of ["upload", "dispatch", "reports"] as const)
      new Setting(this.containerEl)
        .setName(`${kind} credential`)
        .setDesc("Stored separately in macOS Keychain.")
        .addButton((button) =>
          button
            .setButtonText("Replace")
            .onClick(() =>
              new CredentialModal(this.app, this.plugin.keychain, kind).open(),
            ),
        )
        .addButton((button) =>
          button.setButtonText("Remove").onClick(() => {
            void this.plugin.keychain
              .clear(kind)
              .catch(() => new Notice("Keychain credential removal failed"));
          }),
        );
  }
}

class CredentialModal extends Modal {
  private keychain: MacKeychain;
  private kind: CredentialKind;
  constructor(app: App, keychain: MacKeychain, kind: CredentialKind) {
    super(app);
    this.keychain = keychain;
    this.kind = kind;
  }
  onOpen(): void {
    let first = "",
      second = "";
    new Setting(this.contentEl)
      .setName(
        this.kind === "dispatch" ? "GitHub Actions token" : "R2 access key ID",
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text.onChange((value) => {
          first = value;
        });
      });
    if (this.kind !== "dispatch")
      new Setting(this.contentEl)
        .setName("R2 secret access key")
        .addText((text) => {
          text.inputEl.type = "password";
          text.onChange((value) => {
            second = value;
          });
        });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("Save in Keychain").onClick(async () => {
        button.setDisabled(true);
        try {
          await this.keychain.save(
            this.kind,
            this.kind === "dispatch"
              ? first
              : { accessKeyId: first, secretAccessKey: second },
          );
          first = "";
          second = "";
          this.close();
          new Notice("Credential saved in Keychain");
        } catch {
          new Notice("Keychain save failed");
          button.setDisabled(false);
        }
      }),
    );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
