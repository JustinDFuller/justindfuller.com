import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { name: { type: "string" } } });
if (!/^pr-\d+$/.test(values.name ?? ""))
  throw new Error("Preview name must be pr-<number>");
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error("Cloudflare credentials are required");
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/workers/justindfuller-site/previews/${values.name}`,
  {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  },
);
const result = await response.json();
if (!result.success && response.status !== 404)
  throw new Error(
    `Preview deletion failed (${response.status}): ${JSON.stringify(result.errors)}`,
  );
console.log(
  JSON.stringify({
    preview: values.name,
    deleted: result.success,
    alreadyAbsent: response.status === 404,
  }),
);
