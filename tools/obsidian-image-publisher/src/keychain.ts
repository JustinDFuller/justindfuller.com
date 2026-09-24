import { FileSystemAdapter, type App } from "obsidian";
import { join } from "node:path";

const keychainService = "com.justindfuller.obsidian-image-publisher.aws";
const keychainAccount = "aws-credentials";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export class MacKeychain {
  constructor(private readonly app: App, private readonly pluginId: string) {}

  private entry(): KeychainEntry {
    ensureMacOS();
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) throw new Error("Image publishing requires a local vault");
    const bindingPath = join(this.app.vault.adapter.getBasePath(), this.app.vault.configDir, "plugins", this.pluginId, `keyring.darwin-${process.arch}.node`);
    const binding = require(bindingPath) as { Entry: new (service: string, account: string) => KeychainEntry };
    return new binding.Entry(keychainService, keychainAccount);
  }

  async save(credentials: AwsCredentials): Promise<void> {
    ensureMacOS();
    if (!credentials.accessKeyId.trim() || !credentials.secretAccessKey) throw new Error("Enter both AWS key fields");
    this.entry().setPassword(JSON.stringify(credentials));
  }

  async read(): Promise<AwsCredentials | undefined> {
    ensureMacOS();
    const value = this.entry().getPassword();
    if (!value) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Stored AWS credential item is malformed; replace it in plugin settings");
    }
    const candidate = parsed as Partial<AwsCredentials>;
    if (typeof candidate.accessKeyId !== "string" || typeof candidate.secretAccessKey !== "string") {
      throw new Error("Stored AWS credential item is incomplete; replace it in plugin settings");
    }
    return { accessKeyId: candidate.accessKeyId, secretAccessKey: candidate.secretAccessKey };
  }

  async clear(): Promise<void> {
    ensureMacOS();
    this.entry().deletePassword();
  }
}

type KeychainEntry = {
  setPassword(password: string): void;
  getPassword(): string | null;
  deletePassword(): void;
};

function ensureMacOS(): void {
  if (process.platform !== "darwin") throw new Error("Image publishing requires macOS Keychain");
}
