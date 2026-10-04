import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { privateImage, privateHeaders } from "../worker/media.mjs";

const { values } = parseArgs({
  options: {
    state: { type: "string", default: ".obsidian-publish/local" },
    port: { type: "string", default: "8080" },
    "go-port": { type: "string", default: "8081" },
  },
});
const port = Number(values.port),
  goPort = Number(values["go-port"]),
  state = resolve(values.state);
if (
  !Number.isInteger(port) ||
  !Number.isInteger(goPort) ||
  port === goPort ||
  port < 1024 ||
  goPort < 1024 ||
  port > 65535 ||
  goPort > 65535 ||
  !state.startsWith(`${resolve(".obsidian-publish")}/`)
)
  throw new Error("Invalid loopback development configuration");
const prepared = JSON.parse(
  await readFile(join(state, "prepared.json"), "utf8"),
);
const images = JSON.parse(
  await readFile(join(state, "local-images.json"), "utf8"),
);
if (prepared.mode !== "local")
  throw new Error("Use an explicitly prepared local overlay");
const localObject = async (key, body) => {
  const record = prepared.images[key],
    filename = images[key];
  if (!record || !filename || !resolve(filename).startsWith(`${state}/images/`))
    return null;
  const size = (await stat(filename)).size;
  return {
    size,
    httpMetadata: { contentType: record.contentType },
    customMetadata: { sha256: record.sha256, md5: record.md5 },
    ...(body ? { body: Readable.toWeb(createReadStream(filename)) } : {}),
  };
};
const bucket = {
  head: (key) => localObject(key, false),
  get: (key) => localObject(key, true),
};
const go = spawn("go", ["run", "."], {
  env: {
    ...process.env,
    PORT: String(goPort),
    OBSIDIAN_OVERLAY: join(state, "prepared.json"),
  },
  stdio: ["ignore", "ignore", "pipe"],
});
go.stderr.on("data", () => {});
go.on("error", () => {
  console.error("Local renderer could not start");
  process.exit(1);
});
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let response;
    if (url.pathname.startsWith("/__obsidian/"))
      response = await privateImage(
        new Request(url, { method: req.method }),
        bucket,
        prepared.images,
      );
    else
      response = await fetch(
        `http://127.0.0.1:${goPort}${url.pathname}${url.search}`,
        {
          method: req.method,
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        },
      );
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
      ...privateHeaders,
    });
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch {
    res.writeHead(503, privateHeaders);
    res.end();
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Local private preview: http://127.0.0.1:${port}`),
);
const stop = () => {
  server.close();
  go.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
go.on("exit", () => {
  server.close();
});
