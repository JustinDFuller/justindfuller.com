# Cloudflare Obsidian Publishing

Implementation and rollout are in progress. The proposal is `publish-obsidian-through-cloudflare`; its tasks remain the acceptance checklist. Existing Google/AWS resources remain available for separately reviewed retirement.

## Private boundaries

The three Standard R2 buckets are `justindfuller-obsidian-source`, `justindfuller-obsidian-media`, and `justindfuller-obsidian-state`. They were created with public r2.dev access disabled. The media bucket currently remains private; only the completed production promotion path may copy accepted production images into it before its public custom domain is configured. Source Markdown, originals, snapshots, accepted state, reports, and private build archives must remain authenticated.

Staging uses a separate `justindfuller-site-staging` Worker at `staging.justindfuller.com`, with workers.dev and version preview URLs disabled. Nonproduction images use `/__obsidian/media/v1/<sha256>.<extension>` and a deployment-specific allowlist. The handler can read only those image keys, checks metadata, bounds streamed responses, and rejects arbitrary source objects. Production has no private-source runtime binding or image handler.

Before uploading any private hosted artifact, activate Cloudflare Access and configure an exact owner identity. Protect staging with a Worker destination and the production Worker's previews with a `preview_worker` destination. Separate CI Service Auth credentials must have an expiry. Verify anonymous and invalid-token denial on all enabled aliases and immutable URLs using nonsensitive sentinels, then repeat denial checks after authenticated requests. Noindex and private caching accompany Access; authentication is the privacy boundary.

The source uploader requires only source-bucket object read/write. CI source reads, media promotion, state/archive writes, protected report reads, deployment, and Access verification use distinct credentials. R2 object write permissions also permit deletion; the publisher and routine promotion path must never delete. Preserve existing production deployment authority and scope staging authority separately using the narrowest Cloudflare-supported permissions. Do not change zone-wide security settings for this rollout.

## Post metadata

Use `environment: production` for posts eligible everywhere and `environment: nonprod` for local, protected PR, and staging only. `draft: true` is excluded everywhere and can mask an overwritten Git route. Change legacy metadata explicitly, one file at a time:

```sh
node scripts/migrate-obsidian-targets.mjs /absolute/path/post.md
node scripts/migrate-obsidian-targets.mjs /absolute/path/post.md --target nonprod --write
```

The default command is a dry run. It preserves body bytes and reports a body hash. Demotion or removal restores the Git source for an overwrite and removes an additive external route. Previously downloaded public copies and previously promoted public image bytes cannot become retrospectively secret.

## Local preview

Local private output stays in ignored `.obsidian-publish/` files with restricted permissions. Prepare a vault snapshot on demand and launch the loopback gateway:

```sh
node scripts/prepare-local-obsidian.mjs --vault /absolute/path/Blog
node scripts/dev-obsidian.mjs
```

The gateway listens on `127.0.0.1:8080`; Go listens on `127.0.0.1:8081`. Node serves bounded private image streams with the same Worker handler while Go renders Markdown without image-body requests. Both listeners use loopback. The optional `--only` and `--target` preparation inputs support testing one post's eligibility in a private copy without modifying the vault file.

Portable Go commands accept a pinned private source or read R2 directly:

```sh
go run ./cmd/prepare-obsidian --source .obsidian-publish/local/loaded.json --bootstrap --mode local --out .obsidian-publish/local/prepared.json
go run ./cmd/prepare-obsidian --r2 --state .obsidian-publish/accepted.json --mode staging --out .obsidian-publish/staging.json
npm run build:cloudflare -- --mode staging --overlay .obsidian-publish/staging.json
```

The R2 reader uses `OBSIDIAN_SOURCE_ACCESS_KEY_ID` and `OBSIDIAN_SOURCE_SECRET_ACCESS_KEY` from the environment; supply them through a protected credential source. `--bootstrap` is an explicit initial-state decision and must not replace missing accepted state during ordinary publication. Staging/PR output and complete verification manifests belong in private R2 archives, never public Actions artifacts.

## Verification and recovery

Publication transactions journal the candidate, captured serving identity, and prior verified artifact before deployment. State is accepted only after exact artifact verification and a serving-identity check. Failed verification restores and verifies the captured prior version. Failed or unverified rollback leaves an incident journal and requires reconciliation; an orphan serving version is never accepted merely because it is live. Production, staging, and each PR use separate state namespaces.

Measure runner duration, deployment frequency, no-op skips, retries, upload-to-verification latency, and Cloudflare operations for both targets. Reassess observed usage after two weeks and after publishing volume changes, considering GitHub Actions and Cloudflare Builds equally. Include private staging serving and build costs in that comparison.
