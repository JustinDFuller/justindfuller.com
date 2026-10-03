# Cloudflare Deployment

The website uses Go to render public pages at build time and Workers Static Assets to serve them. The Go HTTP server remains available on GCP and locally. Markdown, templates, and source files are never uploaded as Cloudflare assets. Grass reminders have been removed; the temporary worker script and page cleanup remove only the obsolete Grass push registration.

## Build and Preview

Use Go 1.26 and Node 22. Run `npm ci`, `go test ./...`, and `npm run build:cloudflare`. The build replaces `dist`, writes a validation manifest under `.cloudflare`, and invokes `cf build --mode staging`. Running `go run ./cmd/export-static --out dist` directly requires an absent output directory. The exporter rejects duplicate output paths, unresolved LFS assets, rendering errors, and broken internal HTML links. A small number of existing broken content links and metadata URLs were corrected during migration.

Run `npm run dev:cloudflare` after building. Run `node scripts/verify-cloudflare.mjs http://localhost:8787` to check every published page, asset, explicit redirect, draft exclusion, and source-file exclusion against the build artifact. Cloudflare may normalize additional trailing-slash aliases. The existing explicit 301 redirects are retained, and poem and aphorism index redirects use the Go 1.26 server's 307 status.

## Deployment and Credentials

Run `npm run deploy:cloudflare` to upload the previously built artifact using the local Cloudflare login. The Worker is `justindfuller-site` in account `9dce34804a27754a4ea66a5789827dfa`. It has no custom domains or public hostname routes. Its workers.dev address carries `X-Robots-Tag: noindex`, and static assets use Cloudflare's default browser revalidation headers. The cleanup service worker has `Cache-Control: no-store`.

GitHub Actions validates pull requests without Cloudflare credentials. Pushes to main and manual dispatch build, validate, archive, and deploy the same output. Only the deployment step receives `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token is scoped to this account with Workers Scripts Write and Account Settings Read; it has no DNS editing permission. Deployment summaries and downloadable records include the commit SHA, artifact checksum, deployment ID, version ID, and URL. The existing GCP pipeline continues deploying main independently. Both GCP workflows use Node 22 to install the pinned Cloudflare tooling dependencies. PR previews use App Engine's service URL routing and do not replace the shared project's dispatch rules.

Run `node --test scripts/grass.test.mjs` to verify Grass calculations with a synthetic weather forecast and confirm cleanup preserves unrelated service workers. Browser smoke testing covers the Grass introduction, Kit tile swapping, and Weeks Remaining calculations. Live geolocation and weather retrieval require the visitor's own location permission. Existing repository-wide CSS lint findings remain outside this migration; changed JavaScript, Markdown, configuration, and Go checks pass.

## Later Cutover

1. Validate a specific deployment and record its commit, artifact checksum, version ID, and URL. Export and securely retain the current apex and www DNS records using `cf dns records export --zone justindfuller.com`, and record the GCP origin configuration and traffic-serving version.
2. Attach only `justindfuller.com` and `www.justindfuller.com` as Worker custom domains in the configuration. Remove the staging `X-Robots-Tag` rule and set `workersDev: false`. Use a separately authorized credential with the required domain-management permissions for cutover; do not broaden the staging token automatically.
3. Verify HTTPS, rendered content, assets, redirects, and real 404 statuses on both hostnames. Both hostnames serve pages; www does not redirect to the apex. Preserve mail records, wildcard records, other subdomains, registrar configuration, and other GCP services.
4. If verification fails, detach the Worker custom domains, restore the saved apex and www records, and confirm GCP serves both names. Retain the deployed GCP service and its credentials throughout rollback availability.
5. Keep GCP for at least seven days after a successful cutover. Retire only the website's reviewed resources after validation. Do not delete the shared project, Obsidian buckets, reminder secrets or queues, or unrelated applications as part of this deployment.

Registrar transfer is independent of hosting. Obsidian content integration and its GCS or image-delivery infrastructure remain a separate change.

## Lint Policy

New source files follow the no-code-comments policy. The Go lint configuration narrowly excludes documentation-comment findings in the new site and exporter packages and main entrypoint while retaining all other checks. Third-party node_modules code is excluded from Go linting.
