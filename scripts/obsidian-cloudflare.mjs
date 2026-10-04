import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  archiveChecksum,
  inspectPublicationArchive,
  restorePublicationArchive,
} from "./obsidian-archive.mjs";
import { runPublicationCommand } from "./obsidian-process.mjs";
import {
  AccessClient,
  verifyAccessConfiguration,
  accessHeaders,
  assertAccessDenied,
  boundedBody,
} from "./obsidian-access.mjs";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fingerprint = /^[a-f0-9]{64}$/;

export function validateDeploymentArchive(bytes, checksum, { account, mode }) {
  const entries = inspectPublicationArchive(bytes, checksum);
  const object = (name) => {
    const entry = entries.find((item) => item.name === name && !item.directory);
    if (!entry) throw new Error("Artifact configuration missing");
    return JSON.parse(entry.bytes.toString("utf8"));
  };
  const config = object(".cloudflare/output/v0/config.json"),
    worker = object(".cloudflare/output/v0/workers/default/worker.config.json");
  const staging = mode === "staging",
    production = mode === "production";
  const domains = production
    ? ["justindfuller.com", "www.justindfuller.com"]
    : staging
      ? ["staging.justindfuller.com"]
      : [];
  if (
    config.accountId !== account ||
    config.buildContext?.mode !== mode ||
    config.buildContext?.isPreview !== (mode === "preview") ||
    worker.name !==
      (staging ? "justindfuller-site-staging" : "justindfuller-site") ||
    worker.workersDev !== (mode === "preview") ||
    worker.previewUrls !== !staging ||
    JSON.stringify(worker.domains) !== JSON.stringify(domains) ||
    (production && Object.keys(worker.env ?? {}).length)
  )
    throw new Error("Tested artifact target boundary differs");
  return entries;
}

export class CloudflareServing {
  constructor({
    account,
    mode,
    pr,
    token,
    accessConfig,
    accessToken,
    credentials,
    store,
    bootstrapReceipt,
    workspace = ".",
    transport = fetch,
    execute = runPublicationCommand,
  }) {
    if (
      !/^[a-f0-9]{32}$/.test(account) ||
      !["production", "staging", "preview"].includes(mode) ||
      !token ||
      (mode === "preview"
        ? !Number.isSafeInteger(pr) || pr < 1
        : pr !== undefined)
    )
      throw new Error("Explicit Cloudflare publication authority required");
    if (
      mode !== "production" &&
      (accessConfig?.mode !== mode ||
        accessConfig?.account !== account ||
        !accessToken ||
        !credentials?.clientId ||
        !credentials?.clientSecret)
    )
      throw new Error("Separate Access verification credentials required");
    Object.assign(this, {
      account,
      mode,
      pr,
      token,
      accessConfig,
      accessToken,
      credentials,
      store,
      bootstrapReceipt,
      workspace: resolve(workspace),
      transport,
      execute,
    });
    this.worker =
      mode === "staging" ? "justindfuller-site-staging" : "justindfuller-site";
    this.counters = {
      apiReads: 0,
      apiWrites: 0,
      markerReads: 0,
      deployments: 0,
      deploymentAttempts: 0,
      rollbacks: 0,
      rollbackAttempts: 0,
      verifications: 0,
    };
  }

  async api(path, body) {
    if (
      !path.startsWith(`/accounts/${this.account}/workers/`) ||
      path.includes("..")
    )
      throw new Error("Invalid Cloudflare publication resource");
    body ? this.counters.apiWrites++ : this.counters.apiReads++;
    const response = await this.transport(
      `https://api.cloudflare.com/client/v4${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    try {
      if (!response.ok)
        throw new Error("Cloudflare publication metadata unavailable");
      const payload = JSON.parse(
        (await boundedBody(response, 2 * 1024 * 1024)).toString("utf8"),
      );
      if (payload.success !== true || !payload.result)
        throw new Error("Cloudflare publication metadata invalid");
      return payload.result;
    } finally {
      if (!response.bodyUsed) await response.body?.cancel();
    }
  }

  async metadata() {
    const root = `/accounts/${this.account}/workers`;
    const worker = await this.api(`${root}/workers/${this.worker}`);
    let identity, deploymentId, urls;
    if (this.mode === "preview") {
      const path = `${root}/workers/${this.worker}/previews/pr-${this.pr}`;
      const [preview, deployment] = await Promise.all([
        this.api(path),
        this.api(`${path}/deployments/latest`),
      ]);
      identity = deployment.id;
      deploymentId = identity;
      urls = [...(preview.urls ?? []), ...(deployment.urls ?? [])];
      if (
        !urls.length ||
        urls.some((value) => {
          const url = new URL(value);
          return (
            url.protocol !== "https:" ||
            !url.hostname.endsWith(".justindfuller.workers.dev") ||
            url.username ||
            url.password ||
            url.port ||
            url.pathname !== "/" ||
            url.search ||
            url.hash
          );
        })
      )
        throw new Error("Unexpected preview verification destination");
    } else {
      const result = await this.api(
        `${root}/scripts/${this.worker}/deployments`,
      );
      const latest = result.deployments?.[0];
      if (
        latest?.versions?.length !== 1 ||
        latest.versions[0].percentage !== 100
      )
        throw new Error("Single serving version required for publication");
      identity = latest.versions[0].version_id;
      deploymentId = latest.id;
      urls =
        this.mode === "production"
          ? ["https://justindfuller.com", "https://www.justindfuller.com"]
          : ["https://staging.justindfuller.com"];
    }
    if (
      !uuid.test(identity ?? "") ||
      !uuid.test(deploymentId ?? "") ||
      !/^[a-f0-9]{32}$/.test(worker.id ?? "")
    )
      throw new Error("Cloudflare serving identity invalid");
    return {
      identity,
      deploymentId,
      workerId: worker.id,
      urls: [...new Set(urls)],
    };
  }

  async identity() {
    return (await this.metadata()).identity;
  }

  async gate(metadata) {
    if (this.mode === "production") return;
    if (this.accessConfig.worker !== metadata.workerId)
      throw new Error("Access destination differs from the serving Worker");
    const config = {
      ...this.accessConfig,
      hosts: metadata.urls.map((value) => new URL(value).hostname),
      clientId: this.credentials.clientId,
    };
    await verifyAccessConfiguration(
      new AccessClient(this.account, this.accessToken, this.transport),
      config,
    );
    for (const url of metadata.urls)
      await assertAccessDenied(
        url,
        { ...this.credentials, owner: config.owner },
        config.team,
        this.transport,
      );
    return config;
  }

  async artifact(receipt) {
    if (
      !fingerprint.test(receipt?.artifact ?? "") ||
      !receipt.archive?.startsWith("rollback/") ||
      !receipt.verification
    )
      throw new Error("Retained artifact proof required");
    const bytes = await this.store.get(receipt.archive, 256 * 1024 * 1024);
    if (!bytes || archiveChecksum(bytes) !== receipt.artifact)
      throw new Error("Retained tested artifact unavailable");
    const entries = validateDeploymentArchive(
      Buffer.from(bytes),
      receipt.artifact,
      this,
    );
    const marker = receipt.verification.marker;
    if (marker) {
      for (const name of [
        "dist/__publication.json",
        ".cloudflare/output/v0/workers/default/assets/__publication.json",
      ]) {
        const entry = entries.find(
          (item) => item.name === name && !item.directory,
        );
        if (
          marker.path !== "/__publication.json" ||
          !entry ||
          marker.size !== entry.bytes.length ||
          marker.sha256 !== archiveChecksum(entry.bytes)
        )
          throw new Error("Retained archive publication marker differs");
      }
    }
    restorePublicationArchive(
      Buffer.from(bytes),
      receipt.artifact,
      this.workspace,
    );
  }

  async capture(identity) {
    if (this.bootstrapReceipt?.deployment !== identity)
      throw new Error("Explicit verified bootstrap artifact receipt required");
    return this.bootstrapReceipt;
  }

  async marker(receipt, metadata) {
    const proof = receipt.verification?.marker;
    if (
      proof?.path !== "/__publication.json" ||
      !fingerprint.test(proof.sha256 ?? "") ||
      !Number.isSafeInteger(proof.size) ||
      proof.size < 1 ||
      proof.size > 1024
    )
      throw new Error("Publication marker required for deployment correlation");
    const config = await this.gate(metadata);
    for (const base of metadata.urls) {
      this.counters.markerReads++;
      const url = new URL(proof.path, base),
        response = await this.transport(url, {
          headers: config ? accessHeaders(this.credentials) : {},
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
      const bytes = await boundedBody(response, proof.size);
      if (
        response.status !== 200 ||
        bytes.length !== proof.size ||
        archiveChecksum(bytes) !== proof.sha256
      )
        throw new Error("Serving publication marker differs");
      if (config)
        await assertAccessDenied(
          url,
          {
            ...this.credentials,
            owner: config.owner,
            forbiddenHashes: [proof.sha256],
          },
          config.team,
          this.transport,
        );
    }
  }

  async matchesCandidate(candidate, live) {
    try {
      const metadata = await this.metadata();
      if (metadata.identity !== live) return false;
      await this.marker(candidate, metadata);
      return (await this.identity()) === live;
    } catch {
      return false;
    }
  }

  async recoverReceipt(receipt, live) {
    if (
      this.mode !== "preview" ||
      !(await this.matchesCandidate(receipt, live))
    )
      return;
    const restored = { ...receipt, deployment: live };
    await this.verify(restored);
    return restored;
  }

  async deploy(candidate) {
    const before = await this.metadata();
    if (this.verifiedPrior !== before.identity)
      throw new Error("Prior artifact must be verified before private upload");
    await this.gate(before);
    await this.artifact(candidate);
    const args =
      this.mode === "preview"
        ? [
            "cf",
            "previews",
            "deploy",
            `pr-${this.pr}`,
            "--prebuilt",
            "--mode",
            "preview",
          ]
        : [
            "cf",
            "deploy",
            "--prebuilt",
            "--mode",
            this.mode,
            "--message",
            candidate.artifact,
          ];
    this.counters.deploymentAttempts++;
    await this.execute("npx", args, {
      cwd: this.workspace,
      purpose: "deploy",
      token: this.token,
    });
    this.counters.deployments++;
    const after = await this.metadata();
    if (after.identity === before.identity)
      throw new Error("Deployment did not establish a new serving identity");
    return after.identity;
  }

  async verify(receipt) {
    const metadata = await this.metadata();
    if (metadata.identity !== receipt.deployment)
      throw new Error("Artifact receipt differs from the serving identity");
    const config = await this.gate(metadata);
    await this.artifact(receipt);
    const privateDirectory = resolve(
      this.workspace,
      ".obsidian-publish/verification",
    );
    mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
    const configPath = resolve(privateDirectory, "access.json"),
      preparedPath = resolve(privateDirectory, "prepared.json");
    if (config)
      writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
    if (receipt.verification.prepared)
      writeFileSync(
        preparedPath,
        JSON.stringify(receipt.verification.prepared),
        { mode: 0o600 },
      );
    for (const base of metadata.urls) {
      await this.execute(
        process.execPath,
        [
          "scripts/verify-cloudflare.mjs",
          base,
          "--mode",
          this.mode,
          ...(config ? ["--access", configPath] : []),
          ...(receipt.verification.prepared ? ["--overlay", preparedPath] : []),
        ],
        {
          cwd: this.workspace,
          purpose: "verify",
          env: {
            ...process.env,
            CF_ACCESS_CLIENT_ID: this.credentials?.clientId,
            CF_ACCESS_CLIENT_SECRET: this.credentials?.clientSecret,
            CLOUDFLARE_ACCESS_API_TOKEN: this.accessToken,
          },
        },
      );
      this.counters.verifications++;
    }
    if (receipt.verification.marker) await this.marker(receipt, metadata);
    if ((await this.identity()) !== receipt.deployment)
      throw new Error("Serving identity changed during exact verification");
    this.verifiedPrior = metadata.identity;
  }

  async rollback(identity, receipt) {
    if (!uuid.test(identity) || receipt.deployment !== identity)
      throw new Error("Prior rollback identity invalid");
    await this.gate(await this.metadata());
    this.counters.rollbackAttempts++;
    if (this.mode === "preview") {
      await this.artifact(receipt);
      await this.execute(
        "npx",
        [
          "cf",
          "previews",
          "deploy",
          `pr-${this.pr}`,
          "--prebuilt",
          "--mode",
          "preview",
        ],
        { cwd: this.workspace, purpose: "deploy", token: this.token },
      );
      this.counters.rollbacks++;
      return { ...receipt, deployment: await this.identity() };
    }
    await this.api(
      `/accounts/${this.account}/workers/scripts/${this.worker}/deployments`,
      {
        strategy: "percentage",
        versions: [{ version_id: identity, percentage: 100 }],
      },
    );
    this.counters.rollbacks++;
    if ((await this.identity()) !== identity)
      throw new Error("Prior serving version was not restored");
  }
}
