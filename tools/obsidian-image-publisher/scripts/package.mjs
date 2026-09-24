import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
if (process.platform !== "darwin" || !["arm64", "x64"].includes(process.arch)) {
  throw new Error("Package on macOS arm64 or x64 to include the matching Keychain binding");
}
const keyringRoot = dirname(require.resolve("@napi-rs/keyring"));
const keyringManifestPath = join(keyringRoot, "package.json");
const keyringManifest = JSON.parse(await (await import("node:fs/promises")).readFile(keyringManifestPath, "utf8"));
const release = join(root, "release");
const platformPackage = `@napi-rs/keyring-darwin-${process.arch}`;
const packageRoot = (name) => dirname(require.resolve(name));
const platformRoot = packageRoot(platformPackage);

await rm(release, { recursive: true, force: true });
await mkdir(join(release, "node_modules", "@napi-rs"), { recursive: true });
await cp(join(root, "main.js"), join(release, "main.js"));
await cp(join(root, "manifest.json"), join(release, "manifest.json"));
await cp(keyringRoot, join(release, "node_modules", "@napi-rs", "keyring"), { recursive: true });

for (const packageName of Object.keys(keyringManifest.optionalDependencies ?? {})) {
  try {
    const packagePath = packageRoot(packageName);
    await cp(packagePath, join(release, "node_modules", "@napi-rs", packageName.split("/").at(-1)), { recursive: true });
  } catch (error) {
    if (packageName === platformPackage) throw new Error(`Required Keychain binding ${platformPackage} is missing`, { cause: error });
  }
}

const releaseRequire = createRequire(join(release, "main.js"));
const nativeBinding = releaseRequire("@napi-rs/keyring");
if (!nativeBinding.Entry) throw new Error("Packaged Keychain binding did not expose Entry");
if (!platformRoot) throw new Error(`Required Keychain binding ${platformPackage} was not resolved`);
