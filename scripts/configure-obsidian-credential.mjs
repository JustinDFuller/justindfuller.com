import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const kinds = [
  "upload",
  "source-read",
  "media-write",
  "state-write",
  "reports",
];

export function hiddenAnswer(
  prompt,
  input = process.stdin,
  output = process.stdout,
) {
  if (!input.isTTY || typeof input.setRawMode !== "function")
    throw new Error("An interactive local terminal is required");
  return new Promise((resolveAnswer, reject) => {
    let value = "";
    const raw = input.isRaw === true,
      paused = input.isPaused();
    const finish = (error) => {
      input.off("data", data);
      input.setRawMode(raw);
      if (paused) input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolveAnswer(value);
    };
    const data = (bytes) => {
      for (const character of bytes.toString("utf8")) {
        if (character === "\u0003")
          return finish(new Error("Credential entry cancelled"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else if (/^[\x20-\x7e]$/.test(character)) value += character;
        if (value.length > 4096)
          return finish(new Error("Credential input exceeds limit"));
      }
    };
    output.write(prompt);
    input.setRawMode(true);
    input.on("data", data);
    input.resume();
  });
}

export async function configureCredential(kind, ask = hiddenAnswer, save) {
  if (!kinds.includes(kind)) throw new Error("Unknown credential purpose");
  const accessKeyId = (await ask("R2 Access Key ID (hidden): ")).trim();
  const secretAccessKey = (await ask("R2 Secret Access Key (hidden): ")).trim();
  if (
    !/^[a-f0-9]{32}$/.test(accessKeyId) ||
    !/^[a-f0-9]{64}$/.test(secretAccessKey)
  )
    throw new Error("Explicit R2 S3 credential pair required");
  if (!save) {
    if (process.platform !== "darwin")
      throw new Error("macOS Keychain required");
    const require = createRequire(
      new URL(
        "../tools/obsidian-image-publisher/package.json",
        import.meta.url,
      ),
    );
    const { AsyncEntry } = require("@napi-rs/keyring");
    const service = ["upload", "reports"].includes(kind)
      ? "com.justindfuller.obsidian-publisher.cloudflare"
      : "com.justindfuller.obsidian-cloudflare.credentials";
    const entry = new AsyncEntry(service, kind);
    save = (credentials) => entry.setPassword(JSON.stringify(credentials));
  }
  await save({ accessKeyId, secretAccessKey });
  return { status: "stored", kind };
}

async function main() {
  const { values } = parseArgs({ options: { kind: { type: "string" } } });
  console.log(JSON.stringify(await configureCredential(values.kind)));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch(() => {
    console.error(
      "Credential setup failed; use an interactive macOS terminal and the selected bucket-scoped R2 credential pair",
    );
    process.exitCode = 1;
  });
