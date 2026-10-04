import { readFile, writeFile, mkdir, readdir, lstat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateImage } from "../tools/obsidian-image-publisher/src/manifest.ts";
import {
  canonicalSnapshot,
  hash,
} from "../tools/obsidian-image-publisher/src/content.ts";

const { values } = parseArgs({
  options: {
    vault: { type: "string" },
    out: { type: "string", default: ".obsidian-publish/local" },
    only: { type: "string" },
    target: { type: "string" },
    state: { type: "string" },
  },
});
if (
  !values.vault ||
  (values.target && !["nonprod", "production"].includes(values.target))
)
  throw new Error("Supply a vault and a valid optional test target");
const root = resolve(values.vault),
  out = resolve(values.out);
if (!out.startsWith(`${resolve(".obsidian-publish")}/`))
  throw new Error(
    "Private local output must be inside ignored .obsidian-publish",
  );
await mkdir(out, { recursive: true, mode: 0o700 });
const snapshot = { version: 1, files: {}, images: {} },
  bodies = {},
  ready = {},
  localImages = {};
const walk = async (directory) => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Local source symlinks are unsupported");
    if (entry.isDirectory()) result.push(...(await walk(filename)));
    else if (entry.isFile()) result.push(filename);
  }
  return result;
};
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (
    !entry.isFile() ||
    !entry.name.endsWith(".md") ||
    (values.only && entry.name !== values.only)
  )
    continue;
  let bytes = await readFile(join(root, entry.name));
  if (values.target) {
    const value = bytes.toString("utf8");
    if (!/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(value))
      throw new Error("Test source requires frontmatter");
    const end = value.indexOf("\n---", 4);
    const front = value
      .slice(0, end)
      .replace(/^environment:[^\r\n]*$/m, `environment: ${values.target}`);
    bytes = Buffer.from(front + value.slice(end));
  }
  const sha256 = hash(bytes);
  snapshot.files[entry.name] = {
    key: `markdown/v1/${sha256}.md`,
    sha256,
    size: bytes.length,
  };
  bodies[entry.name] = bytes.toString("base64");
}
const imageRoot = join(root, "image");
try {
  if ((await lstat(imageRoot)).isSymbolicLink())
    throw new Error("Local image root cannot be a symlink");
  for (const filename of await walk(imageRoot)) {
    const logical = `image/${relative(imageRoot, filename).split("\\").join("/")}`;
    if (!/\.(jpg|png|svg)$/.test(logical)) continue;
    const stat = await lstat(filename);
    if (stat.size > 20 * 1024 * 1024) continue;
    const bytes = await readFile(filename);
    let image;
    try {
      image = validateImage(`Blog/${logical}`, bytes);
    } catch {
      continue;
    }
    const { sha256, md5, size, contentType, key } = image;
    snapshot.images[logical] = { sha256, md5, size, contentType, key };
    ready[key] = true;
    const cached = join(out, "images", key);
    await mkdir(resolve(cached, ".."), { recursive: true, mode: 0o700 });
    await writeFile(cached, bytes, { mode: 0o600 });
    localImages[key] = cached;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const revision = hash(canonicalSnapshot(snapshot));
await writeFile(
  join(out, "loaded.json"),
  JSON.stringify({ snapshot, revision, bodies, ready }),
  { mode: 0o600 },
);
await writeFile(join(out, "local-images.json"), JSON.stringify(localImages), {
  mode: 0o600,
});
const preparation = spawnSync(
  "go",
  [
    "run",
    "./cmd/prepare-obsidian",
    "--source",
    join(out, "loaded.json"),
    "--mode",
    "local",
    "--out",
    join(out, "prepared.json"),
    ...(values.state ? ["--state", values.state] : ["--bootstrap"]),
  ],
  { stdio: ["ignore", "inherit", "inherit"], env: process.env },
);
if (preparation.status !== 0) process.exit(preparation.status ?? 1);
const prepared = JSON.parse(await readFile(join(out, "prepared.json"), "utf8"));
console.log(
  JSON.stringify({
    revision,
    files: Object.keys(snapshot.files).length,
    images: Object.keys(snapshot.images).length,
    effectiveImages: Object.keys(prepared.images).length,
    issueCategories: prepared.issues.map((issue) => issue.category),
    sourceDigest: createHash("sha256")
      .update(JSON.stringify(snapshot.files))
      .digest("hex"),
  }),
);
