import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    write: { type: "boolean", default: false },
    target: { type: "string" },
  },
});
if (
  positionals.length !== 1 ||
  (values.target && !["nonprod", "production"].includes(values.target))
)
  throw new Error(
    "Supply one Markdown file and an optional nonprod/production target",
  );
const original = await readFile(positionals[0]);
const opening = original.subarray(0, 3).toString();
const end = original.indexOf(Buffer.from("\n---"), 3);
if (opening !== "---" || end < 0) throw new Error("Front matter is required");
const front = original.subarray(0, end).toString("utf8");
const matches = [
  ...front.matchAll(/^environment: (prd|pr|local|nonprod|production)\r?$/gm),
];
if (matches.length !== 1)
  throw new Error("Exactly one supported environment field is required");
const match = matches[0];
const target =
  values.target ??
  { prd: "production", pr: "nonprod", local: "nonprod" }[match[1]] ??
  match[1];
const replaced =
  front.slice(0, match.index) +
  match[0].replace(match[1], target) +
  front.slice(match.index + match[0].length);
const output = Buffer.concat([Buffer.from(replaced), original.subarray(end)]);
const changed = !original.equals(output);
if (values.write && changed) await writeFile(positionals[0], output);
console.log(
  JSON.stringify({
    changed,
    written: values.write && changed,
    target,
    bodySha256: createHash("sha256")
      .update(original.subarray(end + 4))
      .digest("hex"),
  }),
);
