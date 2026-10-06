import { FileSystemAdapter, type App } from "obsidian";
import { join } from "node:path";

const keychainService = "com.justindfuller.obsidian-publisher.cloudflare";
export type CredentialKind = "upload" | "dispatch" | "reports";

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export class MacKeychain {
  constructor(
    private readonly app: App,
    private readonly pluginId: string,
  ) {}

  private entry(kind: CredentialKind): KeychainEntry {
    ensureMacOS();
    if (!(this.app.vault.adapter instanceof FileSystemAdapter))
      throw new Error("Image publishing requires a local vault");
    const bindingPath = join(
      this.app.vault.adapter.getBasePath(),
      this.app.vault.configDir,
      "plugins",
      this.pluginId,
      `keyring.darwin-${process.arch}.node`,
    );
    const binding = require(bindingPath) as {
      AsyncEntry: new (service: string, account: string) => KeychainEntry;
    };
    return new binding.AsyncEntry(keychainService, kind);
  }

  async save(
    kind: CredentialKind,
    credentials: Credentials | string,
  ): Promise<void> {
    ensureMacOS();
    if (
      kind === "dispatch"
        ? typeof credentials !== "string" || !credentials.trim()
        : typeof credentials === "string" ||
          !credentials.accessKeyId.trim() ||
          !credentials.secretAccessKey
    )
      throw new Error("Enter the required credential fields");
    await this.entry(kind).setPassword(JSON.stringify(credentials));
  }

  async read(kind: "dispatch"): Promise<string | undefined>;
  async read(kind: "upload" | "reports"): Promise<Credentials | undefined>;
  async read(kind: CredentialKind): Promise<Credentials | string | undefined> {
    ensureMacOS();
    const value = await this.entry(kind).getPassword();
    if (!value) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Replace the malformed Keychain item");
    }
    if (kind === "dispatch" && typeof parsed === "string" && parsed)
      return parsed;
    const candidate = parsed as Partial<Credentials>;
    if (
      kind === "dispatch" ||
      typeof candidate?.accessKeyId !== "string" ||
      typeof candidate.secretAccessKey !== "string" ||
      !candidate.accessKeyId ||
      !candidate.secretAccessKey
    ) {
      throw new Error("Replace the incomplete Keychain item");
    }
    return {
      accessKeyId: candidate.accessKeyId,
      secretAccessKey: candidate.secretAccessKey,
    };
  }

  async clear(kind: CredentialKind): Promise<void> {
    ensureMacOS();
    await this.entry(kind).deletePassword();
  }
}

type KeychainEntry = {
  setPassword(password: string): Promise<void>;
  getPassword(): Promise<string | undefined>;
  deletePassword(): Promise<boolean>;
};

function ensureMacOS(): void {
  if (process.platform !== "darwin")
    throw new Error("Image publishing requires macOS Keychain");
}
