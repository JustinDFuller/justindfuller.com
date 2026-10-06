import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caller = readFileSync(
  new URL("../.github/workflows/cloudflare.yml", import.meta.url),
  "utf8",
);
const called = readFileSync(
  new URL("../.github/workflows/obsidian-target.yml", import.meta.url),
  "utf8",
);
const common = [
  "OBSIDIAN_STATE_ACCESS_KEY_ID",
  "OBSIDIAN_STATE_SECRET_ACCESS_KEY",
  "OBSIDIAN_SOURCE_ACCESS_KEY_ID",
  "OBSIDIAN_SOURCE_SECRET_ACCESS_KEY",
];
const expected = {
  production: [
    ...common,
    "CLOUDFLARE_API_TOKEN",
    "OBSIDIAN_MEDIA_ACCESS_KEY_ID",
    "OBSIDIAN_MEDIA_SECRET_ACCESS_KEY",
    "OBSIDIAN_BOOTSTRAP_RECEIPT_PRODUCTION_JSON",
  ],
  staging: [
    ...common,
    "CLOUDFLARE_STAGING_API_TOKEN",
    "CLOUDFLARE_ACCESS_API_TOKEN",
    "CF_ACCESS_STAGING_CLIENT_ID",
    "CF_ACCESS_STAGING_CLIENT_SECRET",
    "OBSIDIAN_ACCESS_STAGING_JSON",
    "OBSIDIAN_BOOTSTRAP_RECEIPT_STAGING_JSON",
  ],
  "private-preview": [
    ...common,
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCESS_API_TOKEN",
    "CF_ACCESS_PREVIEW_CLIENT_ID",
    "CF_ACCESS_PREVIEW_CLIENT_SECRET",
    "OBSIDIAN_ACCESS_PREVIEW_JSON",
    "OBSIDIAN_BOOTSTRAP_RECEIPT_PREVIEW_JSON",
  ],
};

test("private target calls authorize only their exact environment secret names", () => {
  const jobs = new Map(
    [
      ...caller.matchAll(
        /^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|(?![\s\S]))/gm,
      ),
    ].map((match) => [match[1], match[2]]),
  );
  for (const [name, names] of Object.entries(expected)) {
    const job = jobs.get(name);
    assert.ok(job, name);
    assert.match(job, /uses: \.\/\.github\/workflows\/obsidian-target\.yml/);
    assert.match(job, /vars\.OBSIDIAN_PUBLISH_ENABLED == 'true'/);
    const mapped = [
      ...job.matchAll(/^      ([A-Z_]+): \$\{\{ secrets\.([A-Z_]+) \}\}$/gm),
    ].map((match) => {
      assert.equal(match[1], match[2]);
      return match[1];
    });
    assert.deepEqual(mapped.sort(), [...names].sort());
    assert.equal(new Set(mapped).size, mapped.length);
  }
  assert.doesNotMatch(caller, /secrets:\s*inherit/);
});

test("the called workflow declares environment names and retains its protected jobs", () => {
  const declarations = [
    ...called.matchAll(/^      ([A-Z_]+):\n        required: false$/gm),
  ].map((match) => match[1]);
  assert.deepEqual(
    declarations.sort(),
    [...new Set(Object.values(expected).flat())].sort(),
  );
  for (const match of called.matchAll(/secrets\.([A-Z_]+)/g))
    assert.ok(declarations.includes(match[1]), match[1]);
  assert.equal(
    (called.match(/environment: obsidian-publish/g) ?? []).length,
    4,
  );
});

test("every pull request retains credential-free site validation", () => {
  const site = caller.split("\n  site:\n")[1].split("\n  preview:\n")[0];
  assert.match(site, /if: github.event_name == 'pull_request' \|\|/);
  assert.doesNotMatch(site, /environment:|OBSIDIAN_STATE_ACCESS_KEY_ID/);
  assert.match(site, /node --test scripts\/\*\.test\.mjs/);
  assert.match(
    site,
    /name: Deploy tested production artifact\n\s+if: github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'/,
  );
});
