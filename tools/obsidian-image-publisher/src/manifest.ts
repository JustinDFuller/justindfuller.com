import { createHash } from "node:crypto";

export type ImageContentType = "image/jpeg" | "image/png" | "image/svg+xml";

export type PublishedImage = {
  sha256: string;
  md5: string;
  size: number;
  contentType: ImageContentType;
  key: string;
};

export type AssetManifest = {
  version: 1;
  images: Record<string, PublishedImage>;
};

export type ValidatedImage = {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  md5: string;
  size: number;
  contentType: ImageContentType;
  key: string;
};

export const manifestPath = "Blog/asset-manifest.json";
export const imageRoot = "Blog/image/";
export const maximumImageBytes = 20 * 1024 * 1024;

const extensions: Record<string, ImageContentType> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export function emptyManifest(): AssetManifest {
  return { version: 1, images: {} };
}

export function parseManifest(value: string): AssetManifest {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Asset manifest must be an object");
  const candidate = parsed as { version?: unknown; images?: unknown };
  if (candidate.version !== 1 || !candidate.images || typeof candidate.images !== "object" || Array.isArray(candidate.images)) {
    throw new Error("Asset manifest version or images map is invalid");
  }
  const images: Record<string, PublishedImage> = {};
  for (const [path, raw] of Object.entries(candidate.images)) {
    if (!path.startsWith("image/") || path.includes("\\") || path.split("/").some((part) => !part || part === ".." || part === ".") || !raw || typeof raw !== "object") {
      throw new Error(`Asset manifest record is invalid for ${path}`);
    }
    const image = raw as Partial<PublishedImage>;
    const extension = path.slice(path.lastIndexOf("."));
    const pathContentType = extensions[extension];
    if (
      typeof image.sha256 === "string" && /^[a-f0-9]{64}$/.test(image.sha256) &&
      typeof image.md5 === "string" && /^[a-f0-9]{32}$/.test(image.md5) &&
      Number.isSafeInteger(image.size) && Number(image.size) > 0 && Number(image.size) <= maximumImageBytes &&
      (image.contentType === "image/jpeg" || image.contentType === "image/png" || image.contentType === "image/svg+xml") &&
      image.contentType === pathContentType &&
      typeof image.key === "string" && image.key === `v1/${image.sha256}.${extensionForType(image.contentType)}`
    ) {
      images[path] = {
        sha256: image.sha256,
        md5: image.md5,
        size: Number(image.size),
        contentType: image.contentType,
        key: image.key,
      };
    } else {
      throw new Error(`Asset manifest record is invalid for ${path}`);
    }
  }
  return { version: 1, images };
}

export function serializeManifest(manifest: AssetManifest): string {
  return `${JSON.stringify({ version: 1, images: manifest.images }, null, 2)}\n`;
}

export function validateImage(path: string, bytes: Uint8Array, maximumBytes = maximumImageBytes): ValidatedImage {
  if (!path.startsWith(imageRoot) || path.includes("\\") || path.split("/").some((part) => part === ".." || part === ".")) {
    throw new Error("Only files inside Blog/image are supported");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > maximumBytes) throw new Error(`Image must be between 1 byte and ${maximumBytes} bytes`);
  const extension = path.slice(path.lastIndexOf("."));
  const contentType = extensions[extension];
  if (!contentType) throw new Error("Only JPG, PNG, and SVG files are supported");
  if (contentType === "image/jpeg" && !isJpeg(bytes)) throw new Error("JPG signature is invalid");
  if (contentType === "image/png" && !isPng(bytes)) throw new Error("PNG signature is invalid");
  if (contentType === "image/svg+xml") validateSvg(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const md5 = createHash("md5").update(bytes).digest("hex");
  return {
    path: path.slice("Blog/".length),
    bytes,
    sha256,
    md5,
    size: bytes.byteLength,
    contentType,
    key: `v1/${sha256}.${extension.slice(1)}`,
  };
}

function extensionForType(contentType: ImageContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "svg";
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function isPng(bytes: Uint8Array): boolean {
  if (!(bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a)) return false;
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = Buffer.from(bytes.buffer, bytes.byteOffset + offset, 4).readUInt32BE(0);
    const chunkEnd = offset + length + 12;
    if (chunkEnd > bytes.length) return false;
    const type = Buffer.from(bytes.buffer, bytes.byteOffset + offset + 4, 4).toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if (!sawHeader && (type !== "IHDR" || length !== 13)) return false;
    if (type === "IHDR") {
      if (sawHeader || offset !== 8) return false;
      const header = Buffer.from(bytes.buffer, bytes.byteOffset + offset + 8, 13);
      const width = header.readUInt32BE(0);
      const height = header.readUInt32BE(4);
      if (width === 0 || height === 0 || width > 16384 || height > 16384 || width * height > 80_000_000) return false;
      sawHeader = true;
    }
    if (type === "IDAT") {
      if (!sawHeader) return false;
      sawData = true;
    }
    const chunk = bytes.subarray(offset + 4, offset + 8 + length);
    const expectedCrc = Buffer.from(bytes.buffer, bytes.byteOffset + offset + 8 + length, 4).readUInt32BE(0);
    if (crc32(chunk) !== expectedCrc) return false;
    offset = chunkEnd;
    if (type === "IEND") return length === 0 && sawHeader && sawData && offset === bytes.length;
  }
  return false;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validateSvg(bytes: Uint8Array): void {
  let value = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  const declaration = value.match(/^\s*(<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?\s*\?>)/i);
  if (declaration) value = value.slice(declaration[1].length);
  if (/<\?|<!/i.test(value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("SVG contains unsupported XML markup");
  const tags = new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc", "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "marker", "symbol", "use"]);
  const attributes = new Set(["xmlns", "xmlns:xlink", "version", "width", "height", "viewbox", "preserveaspectratio", "id", "class", "transform", "d", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "points", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "spreadmethod", "clippathunits", "maskunits", "patternunits", "patterncontentunits", "patterntransform", "markerwidth", "markerheight", "markerunits", "refx", "refy", "orient", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "xml:space", "xml:lang", "role", "aria-label", "focusable", "href", "xlink:href", "clip-path", "clip-rule", "vector-effect", "shape-rendering", "text-rendering"]);
  const stack: string[] = [];
  let position = 0;
  let rootSeen = false;
  let rootClosed = false;
  while (position < value.length) {
    if (value.startsWith("<!--", position)) {
      const end = value.indexOf("-->", position + 4);
      if (end < 0 || value.slice(position + 4, end).includes("--")) throw new Error("SVG comment is malformed");
      position = end + 3;
      continue;
    }
    if (value[position] !== "<") {
      const end = value.indexOf("<", position);
      const text = value.slice(position, end < 0 ? value.length : end);
      if (stack.length === 0 && text.trim()) throw new Error("SVG has text outside its root element");
      if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(text)) throw new Error("SVG contains an invalid entity");
      position = end < 0 ? value.length : end;
      continue;
    }
    let end = position + 1;
    let quote = "";
    while (end < value.length) {
      const character = value[end];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === "\"" || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
      end++;
    }
    if (end >= value.length || quote) throw new Error("SVG tag is malformed");
    let body = value.slice(position + 1, end).trim();
    const closing = body.startsWith("/");
    if (closing) body = body.slice(1).trim();
    const selfClosing = !closing && body.endsWith("/");
    if (selfClosing) body = body.slice(0, -1).trim();
    const nameMatch = body.match(/^([A-Za-z_][A-Za-z\d:_.-]*)/);
    if (!nameMatch) throw new Error("SVG tag name is invalid");
    const name = nameMatch[1];
    const lowerName = name.toLowerCase();
    if (!tags.has(lowerName)) throw new Error("SVG contains an unsupported element");
    if (closing) {
      if (body.slice(name.length).trim() || stack.pop() !== name) throw new Error("SVG closing tags do not match");
      if (stack.length === 0) rootClosed = true;
    } else {
      if (rootClosed) throw new Error("SVG has multiple root elements");
      if (!rootSeen) {
        if (lowerName !== "svg" || stack.length !== 0) throw new Error("SVG root element is invalid");
        rootSeen = true;
      } else if (stack.length === 0) {
        throw new Error("SVG has multiple root elements");
      }
      const rest = body.slice(name.length);
      let offset = 0;
      while (offset < rest.length) {
        while (/\s/.test(rest[offset] ?? "")) offset++;
        if (offset >= rest.length) break;
        const attr = rest.slice(offset).match(/^([A-Za-z_][A-Za-z\d:_.-]*)\s*=\s*(["'])/);
        if (!attr) throw new Error("SVG attribute syntax is invalid");
        const attrName = attr[1];
        const attrValueStart = offset + attr[0].length;
        const quoteChar = attr[2];
        const attrEnd = rest.indexOf(quoteChar, attrValueStart);
        if (attrEnd < 0) throw new Error("SVG attribute value is unterminated");
        const attrValue = rest.slice(attrValueStart, attrEnd);
        const lowerAttribute = attrName.toLowerCase();
        if (!attributes.has(lowerAttribute) || lowerAttribute.startsWith("on") || lowerAttribute === "style") {
          throw new Error("SVG contains an unsupported attribute");
        }
        if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(attrValue)) throw new Error("SVG contains an invalid entity");
        if ((lowerAttribute === "href" || lowerAttribute === "xlink:href") && !/^#[A-Za-z_][A-Za-z\d:.-]*$/.test(attrValue)) {
          throw new Error("SVG references must point to local fragments");
        }
        for (const url of attrValue.matchAll(/url\(([^)]*)\)/gi)) {
          if (!/^\s*#[A-Za-z_][A-Za-z\d:.-]*\s*$/.test(url[1])) throw new Error("SVG URL references must point to local fragments");
        }
        if (/url\(/i.test(attrValue) && !/url\(([^)]*)\)/i.test(attrValue)) throw new Error("SVG URL reference is malformed");
        offset = attrEnd + 1;
      }
      if (!selfClosing) stack.push(name);
      else if (stack.length === 0) rootClosed = true;
    }
    position = end + 1;
  }
  if (!rootSeen || !rootClosed || stack.length !== 0) throw new Error("SVG document is incomplete");
}
