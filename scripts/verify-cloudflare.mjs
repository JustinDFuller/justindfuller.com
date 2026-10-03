import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { mode: { type: "string" } },
});
const [base] = positionals;
if (!base || !["production", "preview"].includes(values.mode))
  throw new Error(
    "Usage: node scripts/verify-cloudflare.mjs <base-url> --mode production|preview",
  );
const manifest = JSON.parse(
  readFileSync(".cloudflare/site-manifest.json", "utf8"),
);
const failures = [];
let checked = 0;
const jobs = [
  ...manifest.pages.map((path) => ({ path, status: 200, method: "GET" })),
  ...manifest.assets.map((path) => ({ path, status: 200, method: "HEAD" })),
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
      try {
        const response = await fetch(new URL(job.path, base), {
          method: job.method,
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        if (response.status !== job.status)
          throw new Error(`status ${response.status}, expected ${job.status}`);
        if (
          job.location &&
          new URL(response.headers.get("location"), base).href !==
            new URL(job.location, base).href
        )
          throw new Error("incorrect redirect");
        const indexing = response.headers.get("x-robots-tag") ?? "";
        if (values.mode === "preview" && !/\bnoindex\b/i.test(indexing))
          throw new Error("missing noindex");
        if (
          values.mode === "production" &&
          /\b(noindex|none)\b/i.test(indexing)
        )
          throw new Error("production indexing is restricted");
        if (
          job.path === "/grass/worker.js" &&
          response.headers.get("cache-control") !== "no-store"
        )
          throw new Error("cleanup service worker must use no-store");
        if (job.method === "GET" && job.status === 200) {
          const pathname = new URL(job.path, base).pathname;
          const filename = pathname.endsWith("/")
            ? `${pathname.slice(1)}index.html`
            : `${pathname.slice(1)}.html`;
          const actual = Buffer.from(await response.arrayBuffer());
          const expected = readFileSync(`dist/${filename}`);
          if (
            createHash("sha256").update(actual).digest("hex") !==
            createHash("sha256").update(expected).digest("hex")
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
        checked++;
      } catch (error) {
        failures.push({ path: job.path, message: error.message });
      }
    }
  }),
);
console.log(JSON.stringify({ base, checked, failures }, null, 2));
if (failures.length) process.exit(1);
