import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { createRequire } from "node:module";
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
  chmod,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  archiveChecksum,
  createPublicationArchive,
  inspectPublicationArchive,
  restorePublicationArchive,
} from "./obsidian-archive.mjs";

const execFile = promisify(execFileCallback);
const account = "9dce34804a27754a4ea66a5789827dfa";
const sourceBucket = "justindfuller-obsidian-source";
const workerDefault = ".cloudflare/output/v0/workers/default";
const workerRoot = `${workerDefault}/`;
const outputConfigPath = ".cloudflare/output/v0/config.json";
const outputRoot = ".cloudflare/output";
const workerConfigPath = `${workerRoot}worker.config.json`;
const workerModulePath = `${workerRoot}bundle/private.js`;
const imageKey = /^v1\/([a-f0-9]{64})\.(jpg|png|svg)$/;
const imageFields = ["contentType", "key", "md5", "sha256", "size"];
const attestationFields = [
  "account",
  "allowlistHash",
  "configHash",
  "controlSha",
  "mode",
  "moduleHash",
  "outputConfigHash",
  "version",
];
const defaultControlWorkspace = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateImages(images) {
  if (!plainObject(images) || Object.keys(images).length > 10000)
    throw new Error("Trusted Worker image allowlist is invalid");
  const output = {};
  for (const key of Object.keys(images).sort()) {
    const record = images[key],
      match = imageKey.exec(key);
    if (
      !match ||
      !plainObject(record) ||
      JSON.stringify(Object.keys(record).sort()) !==
        JSON.stringify(imageFields) ||
      record.key !== key ||
      record.sha256 !== match[1] ||
      !/^[a-f0-9]{32}$/.test(record.md5 ?? "") ||
      !Number.isSafeInteger(record.size) ||
      record.size < 1 ||
      record.size > 20 * 1024 * 1024 ||
      record.contentType !==
        { jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml" }[match[2]]
    )
      throw new Error("Trusted Worker image allowlist is invalid");
    output[key] = {
      sha256: record.sha256,
      md5: record.md5,
      size: record.size,
      contentType: record.contentType,
      key: record.key,
    };
  }
  const bytes = Buffer.from(JSON.stringify(output));
  if (bytes.length > 2 * 1024 * 1024)
    throw new Error("Trusted Worker image allowlist exceeds its limit");
  return { bytes, images: output };
}

function workerConfig(mode) {
  if (!new Set(["staging", "preview"]).has(mode))
    throw new Error("Trusted private Worker mode is invalid");
  const staging = mode === "staging";
  return Buffer.from(
    JSON.stringify({
      name: staging ? "justindfuller-site-staging" : "justindfuller-site",
      compatibilityDate: "2026-10-03",
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "404-page",
        runWorkerFirst: true,
      },
      domains: staging ? ["staging.justindfuller.com"] : [],
      triggers: [],
      workersDev: !staging,
      previewUrls: !staging,
      env: {
        ASSETS: { type: "assets" },
        OBSIDIAN_SOURCE: { type: "r2", name: sourceBucket },
      },
      manifest: {
        type: "complete",
        mainModule: "private.js",
        modules: { "private.js": { type: "esm" } },
      },
    }),
  );
}

function outputConfig(mode, accountId) {
  if (!/^[a-f0-9]{32}$/.test(accountId ?? ""))
    throw new Error("Trusted Worker account is invalid");
  return Buffer.from(
    JSON.stringify({
      accountId,
      buildContext: { isPreview: mode === "preview", mode },
    }),
  );
}

async function trustedRoot(controlWorkspace) {
  return realpath(resolve(controlWorkspace ?? defaultControlWorkspace));
}

async function controlCommit(root) {
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: root,
    maxBuffer: 4096,
  });
  const commit = stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Trusted Worker control commit is invalid");
  return commit;
}

async function trustedFile(root, path) {
  const file = resolve(root, path),
    actual = await realpath(file),
    metadata = await lstat(file);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    !actual.startsWith(`${root}/`)
  )
    throw new Error("Trusted Worker source file is invalid");
  return actual;
}

function makeAttestation(
  mode,
  accountId,
  controlSha,
  moduleBytes,
  configBytes,
  outputConfigBytes,
  allowlistBytes,
) {
  const attestation = {
    version: 1,
    mode,
    account: accountId,
    controlSha,
    moduleHash: digest(moduleBytes),
    configHash: digest(configBytes),
    outputConfigHash: digest(outputConfigBytes),
    allowlistHash: digest(allowlistBytes),
  };
  return {
    ...attestation,
    moduleBytes: Buffer.from(moduleBytes),
    configBytes: Buffer.from(configBytes),
    outputConfigBytes: Buffer.from(outputConfigBytes),
    attestation,
  };
}

function verifyCompiled(compiled) {
  const attestation = compiled?.attestation;
  if (
    compiled?.version !== 1 ||
    !new Set(["staging", "preview"]).has(compiled.mode) ||
    !/^[a-f0-9]{32}$/.test(compiled.account ?? "") ||
    !/^[a-f0-9]{40}$/.test(compiled.controlSha ?? "") ||
    !Buffer.isBuffer(compiled.moduleBytes) ||
    !Buffer.isBuffer(compiled.configBytes) ||
    !Buffer.isBuffer(compiled.outputConfigBytes) ||
    !/^[a-f0-9]{64}$/.test(compiled.moduleHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(compiled.configHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(compiled.outputConfigHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(compiled.allowlistHash ?? "") ||
    digest(compiled.moduleBytes) !== compiled.moduleHash ||
    digest(compiled.configBytes) !== compiled.configHash ||
    digest(compiled.outputConfigBytes) !== compiled.outputConfigHash ||
    !compiled.configBytes.equals(workerConfig(compiled.mode)) ||
    !compiled.outputConfigBytes.equals(
      outputConfig(compiled.mode, compiled.account),
    ) ||
    !plainObject(attestation) ||
    JSON.stringify(Object.keys(attestation).sort()) !==
      JSON.stringify(attestationFields) ||
    attestation.version !== compiled.version ||
    attestation.mode !== compiled.mode ||
    attestation.account !== compiled.account ||
    attestation.controlSha !== compiled.controlSha ||
    attestation.moduleHash !== compiled.moduleHash ||
    attestation.configHash !== compiled.configHash ||
    attestation.outputConfigHash !== compiled.outputConfigHash ||
    attestation.allowlistHash !== compiled.allowlistHash
  )
    throw new Error("Trusted Worker compilation proof is invalid");
  return attestation;
}

export async function compilePrivateWorker({
  mode,
  images,
  account: accountId = account,
  controlWorkspace,
}) {
  const root = await trustedRoot(controlWorkspace),
    allowlist = validateImages(images),
    entry = await trustedFile(root, "worker/private.mjs"),
    media = await trustedFile(root, "worker/media.mjs"),
    expectedAllowlist = resolve(root, ".cloudflare/private-images.mjs"),
    packageRoot = resolve(root, "tools/obsidian-image-publisher/package.json"),
    require = createRequire(packageRoot),
    esbuild = require("esbuild"),
    configBytes = workerConfig(mode),
    outputConfigBytes = outputConfig(mode, accountId),
    controlSha = await controlCommit(root);
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: "private.js",
    bundle: true,
    write: false,
    minify: true,
    legalComments: "none",
    target: "es2022",
    format: "esm",
    platform: "browser",
    metafile: true,
    plugins: [
      {
        name: "trusted-private-image-allowlist",
        setup(build) {
          build.onResolve(
            { filter: /^\.\.\/\.cloudflare\/private-images\.mjs$/ },
            (args) => {
              if (
                args.importer !== entry ||
                resolve(args.resolveDir, args.path) !== expectedAllowlist
              )
                throw new Error("Trusted Worker allowlist import differs");
              return { path: "private-images", namespace: "trusted-images" };
            },
          );
          build.onLoad({ filter: /.*/, namespace: "trusted-images" }, () => ({
            contents: `export default ${allowlist.bytes.toString("utf8")};`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const inputs = Object.keys(result.metafile.inputs).sort();
  if (
    result.errors.length ||
    result.outputFiles.length !== 1 ||
    !result.outputFiles[0].path.endsWith("private.js") ||
    JSON.stringify(inputs) !==
      JSON.stringify([
        "trusted-images:private-images",
        "worker/media.mjs",
        "worker/private.mjs",
      ]) ||
    media !== resolve(root, "worker/media.mjs")
  )
    throw new Error("Trusted private Worker compilation failed");
  const moduleBytes = Buffer.from(result.outputFiles[0].contents);
  return makeAttestation(
    mode,
    accountId,
    controlSha,
    moduleBytes,
    configBytes,
    outputConfigBytes,
    allowlist.bytes,
  );
}

export function validatePrivateWorkerArchive(bytes, checksum, compiled) {
  const attestation = verifyCompiled(compiled),
    entries = inspectPublicationArchive(bytes, checksum),
    files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.name, entry.bytes]),
    ),
    outputEntries = entries.filter((entry) =>
      entry.name.startsWith(`${outputRoot}/`),
    ),
    bundleEntries = entries.filter((entry) =>
      entry.name.startsWith(`${workerRoot}bundle/`),
    ),
    permittedOutputDirectories = new Set([
      outputRoot,
      `${outputRoot}/v0`,
      `${outputRoot}/v0/workers`,
      workerDefault,
      `${workerRoot}assets`,
      `${workerRoot}bundle`,
    ]);
  if (
    !files.get(outputConfigPath)?.equals(compiled.outputConfigBytes) ||
    !files.get(workerModulePath)?.equals(compiled.moduleBytes) ||
    !files.get(workerConfigPath)?.equals(compiled.configBytes) ||
    outputEntries.some(
      (entry) =>
        ![outputConfigPath, workerConfigPath, workerModulePath].includes(
          entry.name,
        ) &&
        !entry.name.startsWith(`${workerRoot}assets/`) &&
        !permittedOutputDirectories.has(entry.name),
    ) ||
    JSON.stringify(
      bundleEntries
        .filter((entry) => !entry.directory)
        .map((entry) => entry.name)
        .sort(),
    ) !== JSON.stringify([workerModulePath]) ||
    bundleEntries.some(
      (entry) =>
        entry.directory &&
        entry.name !== `${workerRoot}bundle` &&
        entry.name !== `${workerRoot}bundle/`,
    )
  )
    throw new Error("Private Worker archive differs from trusted compilation");
  return attestation;
}

export function validateRetainedPrivateWorkerArchive(
  bytes,
  checksum,
  { account: accountId, mode, images, attestation } = {},
) {
  const allowlist = validateImages(images),
    entries = inspectPublicationArchive(bytes, checksum),
    files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.name, entry.bytes]),
    ),
    moduleBytes = files.get(workerModulePath),
    configBytes = files.get(workerConfigPath),
    outputConfigBytes = files.get(outputConfigPath);
  if (
    !plainObject(attestation) ||
    JSON.stringify(Object.keys(attestation).sort()) !==
      JSON.stringify(attestationFields) ||
    attestation.version !== 1 ||
    attestation.mode !== mode ||
    (accountId !== undefined && attestation.account !== accountId) ||
    !/^[a-f0-9]{32}$/.test(attestation.account ?? "") ||
    !/^[a-f0-9]{40}$/.test(attestation.controlSha ?? "") ||
    !/^[a-f0-9]{64}$/.test(attestation.moduleHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(attestation.configHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(attestation.outputConfigHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(attestation.allowlistHash ?? "") ||
    attestation.allowlistHash !== digest(allowlist.bytes) ||
    !moduleBytes ||
    !configBytes ||
    !outputConfigBytes
  )
    throw new Error("Retained private Worker attestation is invalid");
  const compiled = {
    ...attestation,
    moduleBytes: Buffer.from(moduleBytes),
    configBytes: Buffer.from(configBytes),
    outputConfigBytes: Buffer.from(outputConfigBytes),
    attestation,
  };
  return validatePrivateWorkerArchive(bytes, checksum, compiled);
}

export async function repackagePrivateWorkerArchive(
  bytes,
  checksum,
  compiled,
  { controlWorkspace } = {},
) {
  verifyCompiled(compiled);
  inspectPublicationArchive(bytes, checksum);
  const root = await trustedRoot(controlWorkspace),
    privateRoot = resolve(root, ".obsidian-publish");
  try {
    const metadata = await lstat(privateRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("Trusted private workspace is invalid");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  }
  const actualPrivateRoot = await realpath(privateRoot);
  if (actualPrivateRoot !== privateRoot)
    throw new Error("Trusted private workspace is linked");
  const directory = await mkdtemp(join(privateRoot, "worker-package-"));
  try {
    await chmod(directory, 0o700);
    restorePublicationArchive(bytes, checksum, directory);
    const bundleDirectory = resolve(directory, `${workerRoot}bundle`),
      outputDirectory = resolve(directory, outputRoot),
      assetsDirectory = resolve(directory, `${workerRoot}assets`),
      savedAssetsDirectory = resolve(directory, "saved-private-assets"),
      configFile = resolve(directory, workerConfigPath),
      moduleFile = resolve(directory, workerModulePath),
      outputConfigFile = resolve(directory, outputConfigPath);
    const assetInfo = await lstat(assetsDirectory);
    if (!assetInfo.isDirectory() || assetInfo.isSymbolicLink())
      throw new Error("Private Worker static assets are unavailable");
    await rename(assetsDirectory, savedAssetsDirectory);
    await rm(outputDirectory, { recursive: true, force: true });
    await mkdir(dirname(assetsDirectory), {
      recursive: true,
      mode: 0o700,
    });
    await rename(savedAssetsDirectory, assetsDirectory);
    await rm(bundleDirectory, { recursive: true, force: true });
    await mkdir(bundleDirectory, { recursive: true, mode: 0o700 });
    await mkdir(dirname(outputConfigFile), { recursive: true, mode: 0o700 });
    await writeFile(outputConfigFile, compiled.outputConfigBytes, {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(moduleFile, compiled.moduleBytes, {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(configFile, compiled.configBytes, { mode: 0o600 });
    const repackaged = createPublicationArchive(directory),
      repackagedChecksum = archiveChecksum(repackaged),
      attestation = validatePrivateWorkerArchive(
        repackaged,
        repackagedChecksum,
        compiled,
      );
    return {
      bytes: repackaged,
      checksum: repackagedChecksum,
      attestation,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
