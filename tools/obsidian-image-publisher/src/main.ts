import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, type TAbstractFile, type TFile } from "obsidian";
import { ImagePublisher, type ImageVault, type PublishResult } from "./publisher.ts";
import { MacKeychain } from "./keychain.ts";
import { SdkS3Transport, type S3Target } from "./s3.ts";

type DestinationSetting = {
  id: string;
  bucket: string;
  region: string;
};

type Settings = {
  targets: DestinationSetting[];
};

const defaultSettings: Settings = { targets: [] };
const settleDelayMs = 1500;
const fullReconcileMs = 5 * 60 * 1000;
const publisherPrefix = "Blog/image/";

export default class ObsidianImagePublisher extends Plugin {
  settings: Settings = defaultSettings;
  readonly keychain = new MacKeychain();
  private timer: number | undefined;
  private publisher: ImagePublisher | undefined;
  private running = false;
  private rerun = false;
  private status: HTMLElement | undefined;

  async onload(): Promise<void> {
    this.settings = { ...defaultSettings, ...(await this.loadData()) };
    this.status = this.addStatusBarItem();
    this.status.setText("Image publisher: starting");
    this.addCommand({
      id: "publish-now",
      name: "Publish images now",
      callback: () => void this.reconcile(true),
    });
    this.addCommand({
      id: "configure-credentials",
      name: "Configure AWS credentials in Keychain",
      callback: () => new CredentialModal(this.app, this.keychain).open(),
    });
    this.addSettingTab(new ImagePublisherSettings(this.app, this));
    this.registerEvent(this.app.vault.on("create", (file) => this.onFileEvent(file)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.onFileEvent(file)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.onFileEvent(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.queuePath(oldPath, true);
      this.onFileEvent(file);
    }));
    this.registerInterval(window.setInterval(() => this.queueReconcile(), fullReconcileMs));
    window.setTimeout(() => void this.reconcile(false), settleDelayMs);
  }

  onunload(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.queueReconcile();
  }

  private onFileEvent(file: TAbstractFile): void {
    this.queuePath(file.path, true);
  }

  private queuePath(path: string, invalidate = false): void {
    if (!path.startsWith(publisherPrefix)) return;
    if (invalidate) this.publisher?.invalidate(path);
    this.queueReconcile();
  }

  private queueReconcile(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.reconcile(false), settleDelayMs);
  }

  private async reconcile(showEmptyResult: boolean): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    this.status?.setText("Image publisher: checking");
    try {
      const credentials = await this.keychain.read();
      if (!credentials) {
        this.status?.setText("Image publisher: configure Keychain credentials");
        if (showEmptyResult) new Notice("Configure AWS credentials in Keychain before publishing");
        return;
      }
      const targets = this.targets();
      if (!targets.length) {
        this.status?.setText("Image publisher: configure an S3 destination");
        if (showEmptyResult) new Notice("Configure at least one S3 bucket in plugin settings");
        return;
      }
      const transport = new SdkS3Transport(credentials);
      const publisher = this.getPublisher(targets, transport);
      let result: PublishResult;
      try {
        result = await publisher.reconcile();
      } finally {
        transport.close();
      }
      const summary = `${result.uploaded.length} uploaded, ${result.unchanged.length} current, ${result.failed.length} failed`;
      this.status?.setText(`Image publisher: ${summary}`);
      if (result.failed.length || result.uploaded.length || showEmptyResult) new Notice(summary);
      for (const failure of result.failed.slice(0, 3)) new Notice(`${failure.path}: ${failure.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publishing error";
      this.status?.setText("Image publisher: failed");
      new Notice(`Image publishing failed: ${message.slice(0, 220)}`);
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        this.queueReconcile();
      }
    }
  }

  private getPublisher(targets: S3Target[], transport: SdkS3Transport): ImagePublisher {
    if (this.publisher) {
      this.publisher.updateConnection(targets, transport);
      return this.publisher;
    }
    const vault: ImageVault = {
      listImages: () => this.app.vault.getFiles()
        .filter((file) => file.path.startsWith(publisherPrefix))
        .map((file) => ({ path: file.path, size: file.stat.size, mtime: file.stat.mtime })),
      readBinary: (path) => this.app.vault.adapter.readBinary(path),
      readText: async (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !("extension" in file)) return undefined;
        return this.app.vault.read(file as TFile);
      },
      writeText: async (path, value) => {
        await this.app.vault.adapter.write(path, value);
      },
    };
    this.publisher = new ImagePublisher({
      vault,
      targets,
      transport,
    });
    return this.publisher;
  }

  private targets(): S3Target[] {
    return this.settings.targets
      .filter((target) => target.id.trim() && target.bucket.trim() && target.region.trim())
      .map((target) => ({ id: target.id.trim(), bucket: target.bucket.trim(), region: target.region.trim() }));
  }
}

class ImagePublisherSettings extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ObsidianImagePublisher) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian Image Publisher" });
    containerEl.createEl("p", { text: "Uploads JPG, PNG, and safe SVG files from Blog/image to immutable S3 keys. Local files and Markdown references are not changed." });
    new Setting(containerEl)
      .setName("AWS credentials")
      .setDesc("Stored in the macOS Keychain. Scope the access key to PutObject and GetObject on each bucket's v1/* prefix.")
      .addButton((button) => button.setButtonText("Set credentials").onClick(() => new CredentialModal(this.app, this.plugin.keychain).open()));
    new Setting(containerEl)
      .setName("Clear credentials")
      .setDesc("Remove this plugin's AWS credential item from macOS Keychain.")
      .addButton((button) => button.setWarning().setButtonText("Clear").onClick(async () => {
        try {
          await this.plugin.keychain.clear();
          new Notice("Image publisher credentials removed from Keychain");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Keychain operation failed";
          new Notice(message);
        }
      }));
    containerEl.createEl("h3", { text: "S3 destinations" });
    for (const [index, target] of this.plugin.settings.targets.entries()) this.renderTarget(containerEl, target, index);
    new Setting(containerEl)
      .setName("Add destination")
      .setDesc("All configured destinations are verified before the manifest is updated.")
      .addButton((button) => button.setButtonText("Add S3 bucket").onClick(async () => {
        this.plugin.settings.targets.push({ id: `destination-${this.plugin.settings.targets.length + 1}`, bucket: "", region: "" });
        await this.plugin.saveSettings();
        this.display();
      }));
  }

  private renderTarget(container: HTMLElement, target: DestinationSetting, index: number): void {
    new Setting(container).setName(`Destination ${index + 1}`);
    new Setting(container)
      .setName("Label")
      .addText((text) => text.setValue(target.id).onChange(async (value) => {
        target.id = value;
        await this.plugin.saveSettings();
      }));
    new Setting(container)
      .setName("Bucket")
      .addText((text) => text.setValue(target.bucket).onChange(async (value) => {
        target.bucket = value;
        await this.plugin.saveSettings();
      }));
    new Setting(container)
      .setName("Region")
      .addText((text) => text.setValue(target.region).setPlaceholder("us-east-1").onChange(async (value) => {
        target.region = value;
        await this.plugin.saveSettings();
      }));
    new Setting(container)
      .addButton((button) => button.setWarning().setButtonText("Remove").onClick(async () => {
        this.plugin.settings.targets.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      }));
  }
}

class CredentialModal extends Modal {
  private accessKeyId = "";
  private secretAccessKey = "";

  constructor(app: App, private readonly keychain: MacKeychain) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Store AWS credentials in Keychain" });
    this.contentEl.createEl("p", { text: "Use a dedicated key with only PutObject and GetObject permissions for the configured v1/* object prefixes." });
    const access = this.contentEl.createEl("input", { attr: { type: "text", autocomplete: "off", placeholder: "AWS access key ID" } });
    access.addEventListener("input", () => { this.accessKeyId = access.value; });
    const secret = this.contentEl.createEl("input", { attr: { type: "password", autocomplete: "new-password", placeholder: "AWS secret access key" } });
    secret.addEventListener("input", () => { this.secretAccessKey = secret.value; });
    const save = this.contentEl.createEl("button", { text: "Save to Keychain" });
    save.addEventListener("click", () => void this.save(save, secret));
  }

  onClose(): void {
    this.contentEl.empty();
    this.accessKeyId = "";
    this.secretAccessKey = "";
  }

  private async save(button: HTMLButtonElement, secret: HTMLInputElement): Promise<void> {
    button.disabled = true;
    try {
      await this.keychain.save({ accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey });
      secret.value = "";
      new Notice("AWS credentials saved to macOS Keychain");
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Keychain operation failed";
      new Notice(message);
      button.disabled = false;
    }
  }
}
