import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";

const limit = 256 * 1024 * 1024;
const archiveMagic = Buffer.from("OBSARC2\n");
const roots = ["dist", ".cloudflare/output", ".cloudflare/site-manifest.json"];
export const archiveChecksum = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const allowed = (name) =>
  roots.some(
    (root) =>
      name === root || (root !== roots[2] && name.startsWith(`${root}/`)),
  ) &&
  !name.split("/").some((part) => !part || part === "." || part === "..") &&
  !/[\\\x00-\x1f\x7f]/.test(name);
const field = (header, start, size) =>
  header
    .subarray(start, start + size)
    .toString("utf8")
    .replace(/\0.*$/s, "");

function pathFields(name) {
  if (Buffer.byteLength(name) <= 100) return [name, ""];
  const parts = name.split("/");
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join("/"),
      tail = parts.slice(i).join("/");
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(tail) <= 100)
      return [tail, prefix];
  }
  throw new Error("Unsupported artifact path length");
}

export function createPublicationArchive(directory = ".") {
  const records = [];
  let bytes = 1024;
  function visit(name) {
    if (!allowed(name)) throw new Error("Unsupported artifact path");
    const [tail, prefix] = pathFields(name);
    const file = resolve(directory, name),
      stat = lstatSync(file);
    if (!stat.isFile() && !stat.isDirectory())
      throw new Error("Artifact contains a nonregular entry");
    if (stat.size > limit) throw new Error("Artifact file exceeds limit");
    const content = stat.isFile() ? readFileSync(file) : Buffer.alloc(0);
    bytes += 512 + Math.ceil(content.length / 512) * 512;
    if (bytes > limit || records.length >= 20000)
      throw new Error("Artifact archive exceeds limit");
    const header = Buffer.alloc(512);
    header.write(tail, 0, 100);
    header.write(prefix, 345, 155);
    for (const [offset, size, value] of [
      [100, 8, stat.isFile() ? 0o600 : 0o700],
      [108, 8, 0],
      [116, 8, 0],
      [124, 12, content.length],
      [136, 12, 0],
    ])
      header.write(
        `${value.toString(8).padStart(size - 1, "0")}\0`,
        offset,
        size,
      );
    header.fill(32, 148, 156);
    header.write(stat.isFile() ? "0" : "5", 156);
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);
    header.write(
      `${header
        .reduce((sum, value) => sum + value, 0)
        .toString(8)
        .padStart(6, "0")}\0 `,
      148,
      8,
    );
    records.push(
      header,
      content,
      Buffer.alloc((512 - (content.length % 512)) % 512),
    );
    if (stat.isDirectory())
      for (const child of readdirSync(file).sort()) visit(`${name}/${child}`);
  }
  for (const root of roots) visit(root);
  const tar = Buffer.concat([...records, Buffer.alloc(1024)], bytes);
  const entries = inspectPublicationArchive(tar, archiveChecksum(tar));
  const blobs = [],
    blobOffsets = new Map(),
    manifest = [];
  let blobSize = 0;
  for (const entry of entries) {
    if (entry.directory) {
      manifest.push({ name: entry.name, directory: true });
      continue;
    }
    const digest = archiveChecksum(entry.bytes);
    let blob = blobOffsets.get(digest);
    if (!blob) {
      blob = {
        offset: blobSize,
        length: entry.bytes.length,
        bytes: entry.bytes,
      };
      blobOffsets.set(digest, blob);
      blobs.push(entry.bytes);
      blobSize += entry.bytes.length;
    } else if (!entry.bytes.equals(blob.bytes)) {
      throw new Error("Artifact content hash collision");
    }
    manifest.push({
      name: entry.name,
      offset: blob.offset,
      length: blob.length,
    });
  }
  const encodedManifest = Buffer.from(JSON.stringify(manifest));
  const envelope = Buffer.concat([
    archiveMagic,
    Buffer.from([
      encodedManifest.length >>> 24,
      encodedManifest.length >>> 16,
      encodedManifest.length >>> 8,
      encodedManifest.length,
    ]),
    encodedManifest,
    ...blobs,
  ]);
  return gzipSync(envelope, {
    level: 9,
    mtime: 0,
  });
}

export function inspectPublicationArchive(bytes, checksum) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length > limit ||
    archiveChecksum(bytes) !== checksum
  )
    throw new Error("Artifact checksum or size differs");
  let archive = bytes;
  if (
    Buffer.isBuffer(bytes) &&
    bytes.length >= 2 &&
    bytes[0] === 0x1f &&
    bytes[1] === 0x8b
  ) {
    try {
      archive = gunzipSync(bytes, { maxOutputLength: limit });
    } catch {
      throw new Error("Invalid or oversized compressed artifact archive");
    }
  }
  if (!Buffer.isBuffer(archive))
    throw new Error("Artifact archive exceeds limit");
  if (archive.subarray(0, archiveMagic.length).equals(archiveMagic))
    return inspectPublicationEnvelope(archive);
  if (archive.length > limit || archive.length % 512)
    throw new Error("Artifact archive exceeds limit");
  bytes = archive;
  const entries = [],
    names = new Map();
  let offset = 0;
  for (; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const prefix = field(header, 345, 155);
    const name = [prefix, field(header, 0, 100)].filter(Boolean).join("/"),
      kind = field(header, 156, 1);
    const sizeText = field(header, 124, 12).trim(),
      checksumText = field(header, 148, 8).trim();
    const sum = header.reduce(
      (total, value, i) => total + (i >= 148 && i < 156 ? 32 : value),
      0,
    );
    if (
      !allowed(name) ||
      names.has(name) ||
      !["0", "5"].includes(kind) ||
      field(header, 257, 6) !== "ustar" ||
      field(header, 157, 100) ||
      !/^[0-7]+$/.test(sizeText) ||
      !/^[0-7]+$/.test(checksumText) ||
      sum !== parseInt(checksumText, 8)
    )
      throw new Error("Unsafe archive entry");
    const size = parseInt(sizeText, 8);
    if (kind === "5" && size !== 0)
      throw new Error("Invalid archive directory");
    const end = offset + 512 + size,
      next = offset + 512 + Math.ceil(size / 512) * 512;
    if (
      next > bytes.length ||
      !bytes.subarray(end, next).every((value) => value === 0)
    )
      throw new Error("Truncated archive data");
    names.set(name, kind);
    entries.push({
      name,
      directory: kind === "5",
      bytes: bytes.subarray(offset + 512, end),
    });
    if (entries.length > 20000) throw new Error("Archive entry limit exceeded");
    offset = next;
  }
  if (
    bytes.length - offset < 1024 ||
    !bytes.subarray(offset).every((value) => value === 0) ||
    roots.some((root) => !names.has(root)) ||
    names.get("dist") !== "5" ||
    names.get(".cloudflare/output") !== "5" ||
    names.get(".cloudflare/site-manifest.json") !== "0"
  )
    throw new Error("Incomplete artifact archive");
  for (const { name } of entries) {
    for (let parent = dirname(name); parent !== "."; parent = dirname(parent))
      if (names.has(parent) && names.get(parent) !== "5")
        throw new Error("Archive file is used as a directory");
  }
  return entries;
}

function inspectPublicationEnvelope(archive) {
  if (archive.length < archiveMagic.length + 4)
    throw new Error("Incomplete artifact archive");
  const manifestLength = archive.readUInt32BE(archiveMagic.length),
    blobStart = archiveMagic.length + 4 + manifestLength;
  if (blobStart > archive.length)
    throw new Error("Incomplete artifact archive");
  let manifest;
  try {
    manifest = JSON.parse(archive.subarray(archiveMagic.length + 4, blobStart));
  } catch {
    throw new Error("Invalid artifact archive manifest");
  }
  if (!Array.isArray(manifest) || manifest.length > 20000)
    throw new Error("Archive entry limit exceeded");
  const entries = [],
    names = new Map();
  let expandedSize = 0;
  for (const item of manifest) {
    if (
      !item ||
      typeof item.name !== "string" ||
      !allowed(item.name) ||
      names.has(item.name)
    )
      throw new Error("Unsafe archive entry");
    let entry;
    if (item.directory === true && Object.keys(item).length === 2) {
      entry = { name: item.name, directory: true, bytes: Buffer.alloc(0) };
      names.set(item.name, "5");
    } else if (
      item.directory !== true &&
      Number.isSafeInteger(item.offset) &&
      Number.isSafeInteger(item.length) &&
      item.offset >= 0 &&
      item.length >= 0 &&
      (expandedSize += item.length) <= limit &&
      Object.keys(item).length === 3 &&
      blobStart + item.offset + item.length <= archive.length
    ) {
      entry = {
        name: item.name,
        directory: false,
        bytes: archive.subarray(
          blobStart + item.offset,
          blobStart + item.offset + item.length,
        ),
      };
      names.set(item.name, "0");
    } else throw new Error("Unsafe archive entry");
    entries.push(entry);
  }
  if (
    roots.some((root) => !names.has(root)) ||
    names.get("dist") !== "5" ||
    names.get(".cloudflare/output") !== "5" ||
    names.get(".cloudflare/site-manifest.json") !== "0"
  )
    throw new Error("Incomplete artifact archive");
  for (const { name } of entries) {
    for (let parent = dirname(name); parent !== "."; parent = dirname(parent))
      if (names.has(parent) && names.get(parent) !== "5")
        throw new Error("Archive file is used as a directory");
  }
  return entries;
}

export function restorePublicationArchive(bytes, checksum, directory = ".") {
  const entries = inspectPublicationArchive(bytes, checksum);
  const cloudflare = resolve(directory, ".cloudflare");
  try {
    if (
      !lstatSync(cloudflare).isDirectory() ||
      lstatSync(cloudflare).isSymbolicLink()
    )
      throw new Error("Unsafe artifact destination");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const root of roots)
    rmSync(resolve(directory, root), { recursive: true, force: true });
  for (const entry of entries.sort(
    (a, b) => a.name.split("/").length - b.name.split("/").length,
  )) {
    const file = resolve(directory, entry.name);
    mkdirSync(entry.directory ? file : dirname(file), {
      recursive: true,
      mode: 0o700,
    });
    if (!entry.directory)
      writeFileSync(file, entry.bytes, { mode: 0o600, flag: "wx" });
  }
}
