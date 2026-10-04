import { createHash } from "node:crypto";

const uuid = /^[a-f0-9-]{32,36}$/;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class AccessClient {
  constructor(account, token, transport = fetch) {
    if (!/^[a-f0-9]{32}$/.test(account) || !token)
      throw new Error("Access verification credentials required");
    this.account = account;
    this.token = token;
    this.transport = transport;
  }

  async list(resource) {
    if (
      !/^(apps|service_tokens|apps\/[a-f0-9-]{32,36}\/policies)$/.test(resource)
    )
      throw new Error("Invalid Access resource");
    const result = [];
    for (let page = 1; page <= 50; page++) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.account}/access/${resource}?page=${page}&per_page=100`;
      const response = await this.transport(url, {
        headers: { Authorization: `Bearer ${this.token}` },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Access configuration read failed");
      }
      const bytes = await boundedBody(response, 2 * 1024 * 1024);
      const payload = JSON.parse(bytes.toString("utf8"));
      if (payload.success !== true || !Array.isArray(payload.result))
        throw new Error("Invalid Access configuration response");
      result.push(...payload.result);
      const total = payload.result_info?.total_pages;
      if (total !== undefined && (!Number.isInteger(total) || total > 50))
        throw new Error("Access pagination exceeds limit");
      if ((total !== undefined && page >= total) || payload.result.length < 100)
        return result;
    }
    throw new Error("Access pagination exceeds limit");
  }
}

export function checkAccessConfiguration({
  applications,
  policies,
  tokens,
  application,
  worker,
  mode,
  owner,
  serviceToken,
  clientId,
  hosts,
  now = Date.now(),
}) {
  if (
    !uuid.test(application) ||
    !uuid.test(worker) ||
    !uuid.test(serviceToken) ||
    !["staging", "preview"].includes(mode) ||
    typeof owner !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner) ||
    !clientId ||
    !Array.isArray(hosts) ||
    !hosts.length
  )
    throw new Error(
      "Explicit Access destination and owner configuration required",
    );
  const destinationType = mode === "staging" ? "worker" : "preview_worker";
  const app = applications.find((item) => item.id === application);
  if (
    app?.type !== "self_hosted" ||
    app.destinations?.length !== 1 ||
    app.destinations[0].type !== destinationType ||
    app.destinations[0].worker_id !== worker
  )
    throw new Error("Whole Worker Access destination required");
  for (const other of applications) {
    if (other.id === application) continue;
    const overlap = other.destinations?.some(
      (destination) =>
        ["all_workers", "all_preview_workers"].includes(destination.type) ||
        destination.worker_id === worker,
    );
    const domains = [other.domain, ...(other.self_hosted_domains ?? [])].filter(
      Boolean,
    );
    if (
      overlap ||
      domains.some((domain) =>
        hosts.some((host) => {
          const hostname = domain.split("/")[0].toLowerCase();
          return (
            hostname === host ||
            (hostname.startsWith("*.") && host.endsWith(hostname.slice(1)))
          );
        }),
      )
    )
      throw new Error(
        "Overlapping Access application requires operator review",
      );
  }
  if (!Array.isArray(policies) || policies.length !== 2)
    throw new Error("Exactly owner and Service Auth policies required");
  let human = false,
    service = false;
  for (const policy of policies) {
    if (
      policy.include?.length !== 1 ||
      (policy.require?.length ?? 0) !== 0 ||
      (policy.exclude?.length ?? 0) !== 0
    )
      throw new Error("Unexpected Access policy rule");
    const rule = policy.include[0];
    if (
      policy.decision === "allow" &&
      Object.keys(rule).length === 1 &&
      rule.email?.email === owner &&
      Object.keys(rule.email).length === 1 &&
      !human
    )
      human = true;
    else if (
      policy.decision === "non_identity" &&
      Object.keys(rule).length === 1 &&
      rule.service_token?.token_id === serviceToken &&
      Object.keys(rule.service_token).length === 1 &&
      !service
    )
      service = true;
    else throw new Error("Access policy permits an unexpected identity");
  }
  const token = tokens.find((item) => item.id === serviceToken);
  if (
    !human ||
    !service ||
    token?.client_id !== clientId ||
    !Number.isFinite(Date.parse(token?.expires_at)) ||
    Date.parse(token.expires_at) <= now
  )
    throw new Error("Expiring Access Service Auth token required");
}

export async function verifyAccessConfiguration(client, config) {
  const [applications, policies, tokens] = await Promise.all([
    client.list("apps"),
    client.list(`apps/${config.application}/policies`),
    client.list("service_tokens"),
  ]);
  checkAccessConfiguration({ ...config, applications, policies, tokens });
}

export async function boundedBody(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Response exceeds verification limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function accessHeaders(credentials) {
  if (!credentials.clientId || !credentials.clientSecret)
    throw new Error("Access service credentials required");
  return {
    "CF-Access-Client-Id": credentials.clientId,
    "CF-Access-Client-Secret": credentials.clientSecret,
  };
}

export async function assertAccessDenied(
  url,
  credentials,
  team,
  transport = fetch,
) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))
    throw new Error("Explicit Access team domain required");
  for (const headers of [
    {},
    {
      "CF-Access-Authenticated-User-Email": credentials.owner,
      "Cf-Access-Jwt-Assertion": "invalid",
    },
    {
      "CF-Access-Client-Id": credentials.clientId,
      "CF-Access-Client-Secret": "invalid",
    },
  ]) {
    const response = await transport(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    try {
      const login = response.headers.get("location");
      const target = login ? new URL(login, url) : undefined;
      const redirect =
        [302, 303, 307].includes(response.status) &&
        target?.protocol === "https:" &&
        target.hostname === team &&
        target.pathname.startsWith("/cdn-cgi/access/login");
      if (![401, 403].includes(response.status) && !redirect)
        throw new Error("Access denial proof failed");
      const body = await boundedBody(response, 256 * 1024);
      if (
        response.headers.has("x-obsidian-artifact") ||
        (credentials.forbiddenHashes ?? []).includes(hash(body))
      )
        throw new Error("Access denial leaked a protected response");
    } finally {
      if (!response.bodyUsed) await response.body?.cancel();
    }
  }
}

export async function proveSentinels(
  proofs,
  config,
  credentials,
  transport = fetch,
) {
  if (!Array.isArray(proofs) || !proofs.length)
    throw new Error("Sentinel proof required before private deployment");
  for (const proof of proofs) {
    const url = new URL(proof.url);
    if (
      url.protocol !== "https:" ||
      !config.hosts.includes(url.hostname) ||
      url.username ||
      url.password ||
      !/^[a-f0-9]{64}$/.test(proof.sha256) ||
      !Number.isSafeInteger(proof.size) ||
      proof.size <= 0 ||
      proof.size > 65536
    )
      throw new Error("Invalid sentinel destination");
    const deny = {
      ...credentials,
      owner: config.owner,
      forbiddenHashes: [proof.sha256],
    };
    await assertAccessDenied(url, deny, config.team, transport);
    const response = await transport(url, {
      headers: accessHeaders(credentials),
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    const body = await boundedBody(response, proof.size);
    if (
      response.status !== 200 ||
      body.length !== proof.size ||
      hash(body) !== proof.sha256
    )
      throw new Error("Authenticated sentinel verification failed");
    await assertAccessDenied(url, deny, config.team, transport);
  }
  if (
    new Set(proofs.map((proof) => new URL(proof.url).hostname)).size !==
    config.hosts.length
  )
    throw new Error("Sentinel proof missing an enabled hostname");
}
