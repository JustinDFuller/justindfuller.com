import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
if (process.platform !== "darwin" || !["arm64", "x64"].includes(process.arch)) {
  throw new Error("Package on macOS arm64 or x64 to include the matching Keychain binding");
}
const release = join(root, "release");
const platformPackage = `@napi-rs/keyring-darwin-${process.arch}`;
const nativePath = require.resolve(platformPackage);

await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(join(root, "main.js"), join(release, "main.js"));
await cp(join(root, "manifest.json"), join(release, "manifest.json"));
await cp(nativePath, join(release, `keyring.darwin-${process.arch}.node`));

const nativeBinding = require(join(release, `keyring.darwin-${process.arch}.node`));
if (!nativeBinding.Entry) throw new Error("Packaged Keychain binding did not expose Entry");
