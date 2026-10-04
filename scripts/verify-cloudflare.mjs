import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import {
  AccessClient,
  verifyAccessConfiguration,
  assertAccessDenied,
  accessHeaders,
  boundedBody,
} from "./obsidian-access.mjs";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      attempts: { type: "string", default: "7" },
      "retry-delay-ms": { type: "string", default: "10000" },
      access: { type: "string" },
      overlay: { type: "string" },
    },
  });
  const [base] = positionals;
  if (!base || !["production", "preview", "staging"].includes(values.mode))
    throw new Error(
      "Usage: node scripts/verify-cloudflare.mjs <base-url> --mode production|preview|staging",
    );
  const isPrivate = Boolean(values.access);
  let accessConfig, credentials, headers;
  try {
    if (
      (values.mode === "staging" && !isPrivate) ||
      (values.mode === "production" && isPrivate)
    )
      throw new Error("Invalid Access mode");
    if (isPrivate) {
      accessConfig = JSON.parse(readFileSync(values.access, "utf8"));
      const destination = new URL(base);
      if (
        accessConfig.mode !== values.mode ||
        destination.protocol !== "https:" ||
        !accessConfig.hosts.includes(destination.hostname) ||
        destination.username ||
        destination.password
      )
        throw new Error("Invalid private verification destination");
      credentials = {
        owner: accessConfig.owner,
        clientId: process.env.CF_ACCESS_CLIENT_ID,
        clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
      };
      headers = accessHeaders(credentials);
      await verifyAccessConfiguration(
        new AccessClient(
          accessConfig.account,
          process.env.CLOUDFLARE_ACCESS_API_TOKEN,
        ),
        {
          ...accessConfig,
          clientId: credentials.clientId,
        },
      );
    }
  } catch {
    console.error(
      "Private verification blocked: Access configuration unavailable or unsafe",
    );
    process.exit(1);
  }
  const attempts = Number(values.attempts);
  const retryDelay = Number(values["retry-delay-ms"]);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 7)
    throw new Error("Verification attempts must be an integer from 1 to 7");
  if (!Number.isInteger(retryDelay) || retryDelay < 0 || retryDelay > 10000)
    throw new Error(
      "Retry delay must be an integer from 0 to 10000 milliseconds",
    );
  const manifest = JSON.parse(
    readFileSync(".cloudflare/site-manifest.json", "utf8"),
  );
  const images = values.overlay
    ? JSON.parse(readFileSync(values.overlay, "utf8")).images
    : {};
  if (!images || Object.keys(images).length > 10000)
    throw new Error("Image verification metadata exceeds limit");
  for (const [key, record] of Object.entries(images)) {
    const match = key.match(
      /^v1\/([a-f0-9]{64})\.(png|jpg|jpeg|gif|webp|svg|avif)$/,
    );
    const types = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      avif: "image/avif",
    };
    if (
      !match ||
      record.key !== key ||
      record.sha256 !== match[1] ||
      record.contentType !== types[match[2]] ||
      !Number.isSafeInteger(record.size) ||
      record.size < 1 ||
      record.size > 20 * 1024 * 1024
    )
      throw new Error("Invalid image verification metadata");
  }
  if ((manifest.privateImages?.length ?? 0) > 0 && !isPrivate)
    throw new Error("Private images require authenticated verification");
  const failures = [];
  let checked = 0;
  const jobs = [
    ...manifest.pages.map((path) => ({ path, status: 200, method: "GET" })),
    ...manifest.assets.map((path) => ({
      path,
      status: 200,
      method: isPrivate ? "GET" : "HEAD",
      asset: true,
    })),
    ...(manifest.privateImages ?? []).map((path) => ({
      path,
      status: 200,
      method: "GET",
      image: true,
    })),
    ...(values.mode === "production"
      ? Object.keys(images).map((key) => {
          if (!/^v1\/[a-f0-9]{64}\.(png|jpg|jpeg|gif|webp|svg|avif)$/.test(key))
            throw new Error("Invalid public image verification key");
          return {
            path: `https://media.justindfuller.com/${key}`,
            status: 200,
            method: "GET",
            image: true,
            publicImage: true,
          };
        })
      : []),
    ...[
      "/__missing",
      "/story/nothing",
      "/story/bridge",
      "/programming/go-tip-function-arguments",
      "/main.go",
      "/go.mod",
      "/cloudflare.config.ts",
      "/main.template.html",
      "/.env",
      "/.appengine/app.yaml",
      "/.cloudflare/site-manifest.json",
      "/programming/2022-12-01_go_tip_function_arguments.md",
      "/_headers",
      "/_redirects",
      "/reminder/set",
      "/reminder/send",
    ].map((path) => ({ path, status: 404, method: "GET" })),
    ...Object.entries({
      "/about/": "/about",
      "/make/": "/make",
      "/word/": "/word",
      "/programming/": "/programming",
      "/poem": "/poem/",
      "/aphorism": "/aphorism/",
    }).map(([path, location]) => ({
      path,
      status: ["/poem", "/aphorism"].includes(path) ? 307 : 301,
      method: "GET",
      location,
    })),
    {
      path: "/about/?cutover=1&value=a%2Fb",
      status: 301,
      method: "GET",
      location: "/about?cutover=1&value=a%2Fb",
    },
    { path: "/?cutover=1", status: 200, method: "GET" },
  ];
  let next = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        for (let attempt = 1; attempt <= attempts; attempt++) {
          let response;
          try {
            const url = new URL(job.path, base);
            if (isPrivate)
              await assertAccessDenied(url, credentials, accessConfig.team);
            response = await fetch(new URL(job.path, base), {
              method: job.method,
              headers: job.publicImage
                ? { "Accept-Encoding": "identity" }
                : headers,
              redirect: "manual",
              signal: AbortSignal.timeout(30000),
            });
            if (response.status !== job.status)
              throw new Error(
                `status ${response.status}, expected ${job.status}`,
              );
            if (
              job.location &&
              new URL(response.headers.get("location"), base).href !==
                new URL(job.location, base).href
            )
              throw new Error("incorrect redirect");
            const indexing = response.headers.get("x-robots-tag") ?? "";
            if (values.mode !== "production" && !/\bnoindex\b/i.test(indexing))
              throw new Error("missing noindex");
            if (
              isPrivate &&
              (!/\bno-store\b/i.test(
                response.headers.get("cache-control") ?? "",
              ) ||
                !/\bprivate\b/i.test(
                  response.headers.get("cache-control") ?? "",
                ))
            )
              throw new Error("private response must use no-store");
            if (
              values.mode === "production" &&
              /\b(noindex|none)\b/i.test(indexing)
            )
              throw new Error("production indexing is restricted");
            if (
              job.path === "/grass/worker.js" &&
              !/\bno-store\b/i.test(response.headers.get("cache-control") ?? "")
            )
              throw new Error("cleanup service worker must use no-store");
            if (job.method === "GET" && job.status === 200) {
              if (
                !job.publicImage &&
                !/\bno-transform\b/i.test(
                  response.headers.get("cache-control") ?? "",
                )
              )
                throw new Error("HTML must prevent edge transformations");
              const pathname = new URL(job.path, base).pathname;
              const filename = job.asset
                ? pathname.slice(1)
                : pathname === "/sitemap.xml"
                  ? "sitemap.xml"
                  : pathname.endsWith("/")
                    ? `${pathname.slice(1)}index.html`
                    : `${pathname.slice(1)}.html`;
              const image = job.image
                ? images[
                    job.publicImage
                      ? pathname.slice(1)
                      : pathname.slice("/__obsidian/media/".length)
                  ]
                : undefined;
              if (job.image && !image)
                throw new Error("private image proof missing");
              if (
                job.publicImage &&
                response.headers.get("cache-control") !==
                  "public, max-age=31536000, immutable"
              )
                throw new Error("Public image caching differs");
              if (
                job.image &&
                (response.headers.get("content-type") !== image.contentType ||
                  response.headers.get("content-length") !== String(image.size))
              )
                throw new Error("private image response metadata differs");
              const expected = job.image
                ? undefined
                : readFileSync(`dist/${filename}`);
              const actual = await boundedBody(
                response,
                job.image ? image.size : expected.length,
              );
              if (
                actual.length !== (job.image ? image.size : expected.length) ||
                createHash("sha256").update(actual).digest("hex") !==
                  (job.image
                    ? image.sha256
                    : createHash("sha256").update(expected).digest("hex"))
              )
                throw new Error("HTML differs from artifact");
              if (
                values.mode === "production" &&
                /<meta\b[^>]*(?:noindex|content=["']none["'])/i.test(
                  actual.toString(),
                )
              )
                throw new Error("production HTML restricts indexing");
            } else await response.body?.cancel();
            if (isPrivate)
              await assertAccessDenied(url, credentials, accessConfig.team);
            checked++;
            break;
          } catch (error) {
            if (response?.body && !response.bodyUsed)
              await response.body.cancel().catch(() => {});
            if (attempt < attempts) {
              await setTimeout(retryDelay);
              continue;
            }
            failures.push({ path: job.path, message: error.message });
          }
        }
      }
    }),
  );
  if (isPrivate) {
    mkdirSync(".obsidian-publish", { recursive: true, mode: 0o700 });
    writeFileSync(
      ".obsidian-publish/verification.json",
      JSON.stringify({ base, checked, failures }),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({ mode: values.mode, checked, failed: failures.length }),
    );
  } else console.log(JSON.stringify({ base, checked, failures }, null, 2));
  if (failures.length) process.exit(1);
}

await main().catch(() => {
  console.error(
    "Cloudflare verification failed; inspect private verification inputs",
  );
  process.exitCode = 1;
});
