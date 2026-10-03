# Cloudflare Deployment

Go renders public pages at build time and Workers Static Assets serves production on `justindfuller.com` and `www.justindfuller.com`. Both hostnames serve the same site. Markdown, templates, source files, drafts, and the private validation manifest are excluded from public assets. Grass reminders remain removed; its cleanup service worker uses `Cache-Control: no-store`.

## Build and Validate

Use Go 1.26 and Node 22. Install pinned tooling with `npm ci`, then run `go test ./...` and `node --test scripts/*.test.mjs`.

```sh
npm run build:cloudflare -- --mode preview
npm run dev:cloudflare
node scripts/verify-cloudflare.mjs http://localhost:8787 --mode preview
```

`preview` is the safe default build mode. It adds `X-Robots-Tag: noindex`, excludes production domain assignments, and creates native Preview Build Output. Production builds use `npm run build:cloudflare -- --mode production`, omit the indexing restriction, and configure exactly the apex and www custom domains. Invalid or unspecified Cloudflare configuration modes fail before deployment. The exporter rejects duplicate paths, unresolved LFS assets, rendering errors, and broken internal HTML links. The build replaces `dist`; direct exporter runs require an absent output directory.

`npm run deploy:cloudflare` deploys a previously built production artifact. `make deploy` builds production first. A local preview of production assets can use `npx cf dev --mode production`; verify it with `--mode production`. Deploy commands reject an artifact built for a different mode.

## Production and Credentials

The Worker is `justindfuller-site` in account `9dce34804a27754a4ea66a5789827dfa`. Production has `workersDev: false`; `previewUrls: true` is required for native PR Preview URLs and is configured independently of production workers.dev routing. Native previews are public and have noindex headers. Custom-domain preview routing is not enabled, so no wildcard DNS is created for previews. See [Cloudflare preview routing](https://developers.cloudflare.com/workers/previews/custom-domains/).

Pushes to main and manual dispatches build, test, archive, and deploy the same artifact. The archive contains `dist`, Cloudflare Build Output, and the private manifest. Each run verifies both production hostnames against the built pages and assets, including redirect query strings, real 404 responses, source/draft exclusions, indexing headers, and cleanup-worker caching. Production deployment records contain commit SHA, artifact checksum, deployment ID, version ID, and both URLs.

Only deployment steps receive `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Keep the routine token scoped to Workers Scripts Write and Account Settings Read in this account. Initial domain attachment and DNS replacement use a separate authorized local credential with the zone-management permissions. Steady deployments must not add, remove, or change domain assignments. Do not broaden the CI token to solve a domain-management error; perform authorized routing changes locally and retry. GitHub workflow results provide the runtime proof that the routine token can redeploy the existing attachments.

## PR Previews

Same-repository PRs other than Dependabot get a native Cloudflare Preview named `pr-<number>`. Fork and Dependabot PRs still build and validate without Cloudflare credentials. The preview job downloads and checks the artifact checksum before uploading the prebuilt artifact; it does not rebuild. It verifies the unique deployment URL and updates the existing bot comment with the stable URL, deployment URL, PR head SHA, and tested merge SHA. See [Cloudflare Previews](https://developers.cloudflare.com/workers/previews/).

```sh
npm run build:cloudflare -- --mode preview
npm run preview:cloudflare -- pr-123
```

Native Previews have their own immutable deployment IDs rather than production Worker version IDs. Their records include `deploymentId`, `previewId`, `previewName`, the exact URL, and `previewUrl`; `versionId` is explicitly null. Preview URL routing must be enabled on the parent Worker before its first preview deployment. Production and each PR have separate concurrency groups, with close cleanup sharing that PR's group so a deployment cannot race deletion.

Closed PRs delete only their corresponding Cloudflare Preview. Cleanup uses the default branch's script and a fixed Worker target, treats an absent preview as already cleaned up, and fails on other API errors. Existing GAE previews are retained for separately reviewed cleanup. The GAE preview/deploy/cleanup workflows have been removed; no new GAE deployments or version deletion happen automatically.

## Cutover and Rollback

Before cutover, securely export the complete DNS zone and retain structured DNS records, App Engine domain mappings, application dispatch rules, the default service's traffic assignment and serving versions, and the current Worker deployment/domain assignments. Keep these outside published assets and outside uploaded workflow artifacts. Refresh this snapshot immediately before changing routing.

The original apex has four Google A records (`216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21`) and four AAAA records (`2001:4860:4802:32::15`, `2001:4860:4802:34::15`, `2001:4860:4802:36::15`, `2001:4860:4802:38::15`). The original www CNAME is `ghs.googlehosted.com`. All were proxied with automatic TTL. The snapshot is authoritative if these settings change.

Attach only the apex and www to the existing Worker after testing. Replace only their A/AAAA/CNAME hosting records; an existing www CNAME must be removed before attaching its custom domain. Cloudflare creates the Worker DNS and TLS certificates. Verify HTTPS and the full artifact on both names, purge only those two hosts' cached responses, and verify again. Preserve the Google wildcard, email records, other subdomains, registrar settings, other GCP services, GAE preview services, and content/image infrastructure.

If verification fails, stop or disable the Cloudflare deployment workflow before restoring GAE routing so an automatic deployment cannot undo rollback. In the Cloudflare Worker settings, remove only `justindfuller.com` and `www.justindfuller.com` custom-domain attachments. Restore only those hostnames' saved A/AAAA/CNAME records, including proxy and TTL settings; do not import or replace the full zone. Keep MX/TXT and all other records unchanged. Restore the recorded GAE default-service traffic assignment only if it changed, then verify both HTTPS names serve the retained origin. Purge only those two hosts and verify again. Reattaching Worker domains requires a separately authorized cutover.

Retain the GAE serving version, domain mappings, shared dispatch configuration, and credentials for at least seven days after successful cutover. Do not disable the App Engine application or delete the shared project: interviews, notes, Lauren's sites, and other resources remain there. GAE retirement is a separate change. The cutover record documents the exact verification time, deployment identity, backup location, and earliest retirement date.

## Validation and Lint

New source files follow the no-code-comments policy. Run ESLint and Prettier on changed scripts/configuration, Markdown lint on changed docs, exporter and Go tests, JavaScript tests, and Cloudflare production dry runs. Existing repository-wide CSS findings remain outside this migration. Browser smoke checks cover navigation, Grass, Kit, and Weeks Remaining. Live geolocation and weather retrieval require the visitor's permission.
