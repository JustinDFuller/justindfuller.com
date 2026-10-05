# Cloudflare Obsidian Publishing

Implementation and rollout are in progress. The proposal is `publish-obsidian-through-cloudflare`; its tasks remain the acceptance checklist. Existing Google/AWS resources remain available for separately reviewed retirement.

## Private boundaries

The three Standard R2 buckets are `justindfuller-obsidian-source`, `justindfuller-obsidian-media`, and `justindfuller-obsidian-state`. They were created with public r2.dev access disabled. The media bucket currently remains private; only the completed production promotion path may copy accepted production images into it before its public custom domain is configured. Source Markdown, originals, snapshots, accepted state, reports, and private build archives must remain authenticated.

Staging uses a separate `justindfuller-site-staging` Worker at `staging.justindfuller.com`, with workers.dev and version preview URLs disabled. Nonproduction images use `/__obsidian/media/v1/<sha256>.<extension>` and a deployment-specific allowlist. The handler can read only those image keys, checks metadata, bounds streamed responses, and rejects arbitrary source objects. Production has no private-source runtime binding or image handler.

Before uploading any private hosted artifact, activate Cloudflare Access and configure an exact owner identity. Protect staging with a Worker destination and the production Worker's previews with a `preview_worker` destination. Separate CI Service Auth credentials must have an expiry. Verify anonymous and invalid-token denial on all enabled aliases and immutable URLs using nonsensitive sentinels, then repeat denial checks after authenticated requests. Noindex and private caching accompany Access; authentication is the privacy boundary.

The source uploader requires only source-bucket object read/write. CI source reads, media promotion, state/archive writes, protected report reads, deployment, and Access verification use distinct credentials. R2 object write permissions also permit deletion; the publisher and routine promotion path must never delete. Preserve existing production deployment authority and scope staging authority separately using the narrowest Cloudflare-supported permissions. Do not change zone-wide security settings for this rollout.

## Access provisioning gate

Zero Trust onboarding was verified on 2026-10-04. Staging now has a sentinel-only Worker, custom domain, exact owner policy, and expiring Service Auth credential; its live denial and authenticated sentinel checks passed. Production-Worker preview protection remains a separate rollout step. Enable Zero Trust on the site account before configuring the two self-hosted applications. The staging application must contain exactly one `worker` destination for the staging Worker's ID. The preview application must contain exactly one `preview_worker` destination for the production Worker's ID. Worker IDs are platform IDs, not the Worker names. These destinations cover the Worker's alternate domains and native previews; see [Cloudflare's Worker Access documentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

Each application uses exactly two policies: an `allow` policy whose only include rule is the explicitly selected owner's exact `email`, and a `non_identity` Service Auth policy whose only include rule is the dedicated expiring `service_token`. Do not add everyone, email-domain, bypass, or alternate allow rules. Store the service client ID/secret separately from the Access configuration read credential. This implementation conservatively blocks overlapping account-wide, Worker, and matching-hostname applications for operator review.

Save operator configuration privately in `.obsidian-publish/access-staging.json` or the corresponding preview configuration. Populate every enabled alias and immutable hostname from the actual Cloudflare deployment inventory; staging's disabled workers.dev/version URLs do not need enabling. The configuration format is:

```json
{
  "account": "Cloudflare account ID",
  "application": "Access application ID",
  "worker": "Worker platform ID",
  "mode": "staging",
  "owner": "explicitly-selected-owner@example.com",
  "serviceToken": "Access service token ID",
  "team": "your-team.cloudflareaccess.com",
  "hosts": ["staging.justindfuller.com"]
}
```

First deploy only nonsensitive sentinel assets. Save the enabled sentinel URLs, exact SHA-256, and byte size as a private array of `{ "url": "https://.../sentinel", "sha256": "...", "size": 42 }` records. Supply `CLOUDFLARE_ACCESS_API_TOKEN`, `CF_ACCESS_CLIENT_ID`, and `CF_ACCESS_CLIENT_SECRET` through protected environment credentials, then run:

```sh
node scripts/check-obsidian-access.mjs --config .obsidian-publish/access-staging.json --sentinels .obsidian-publish/sentinels.json
node scripts/verify-cloudflare.mjs https://staging.justindfuller.com --mode staging --access .obsidian-publish/access-staging.json --overlay .obsidian-publish/staging.json
```

The first command reads all Access application/policy pages and service token metadata, checks the exact destination and identity boundaries, and requires anonymous, spoofed-identity, and invalid-service-token denial before and after an authenticated exact-byte sentinel request. It fails before private upload when any enabled hostname lacks proof. The live verifier repeats configuration checks and denial around authenticated HTML, redirects, assets, sitemap, and allowlisted image requests; private failures are written to ignored local verification data while public output contains counts only. Git-only previews may use the original unauthenticated verifier until the private preview integration is installed; they cannot use a private image manifest without Access credentials.

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

For a code build during a source outage, explicitly revalidate that target's accepted state. Content-only reconciliation instead preserves the deployed site while reporting the source failure. Missing, incompatible, cross-target, or newly conflicting accepted state blocks deployment rather than silently replacing its overlay with Git-only content:

```sh
go run ./cmd/prepare-obsidian --accepted-only --state .obsidian-publish/accepted-production.json --mode production --out .obsidian-publish/degraded-production.json
```

Fallback retains each accepted file's own image revisions and draft masks. `--unavailable-images` accepts a private JSON array of unavailable immutable image keys; revalidation omits those references while retaining valid post bodies. Degraded preparation preserves the accepted source revision and produces a protected issue. It cannot be combined with source reads or bootstrap.

## Public image promotion

For accepted-state production fallback, verify the same effective image authorization and public destinations without requiring a fresh pinned source. The command still uses source-read and media-write credentials: an existing valid public object needs only destination metadata; an absent object can be recovered from its immutable private original. Authentication failures block the operation. Failed individual destinations are written as a private array and must be removed by a second accepted-state preparation before computing the final digest or building:

```sh
node scripts/promote-obsidian-images.mjs --overlay .obsidian-publish/degraded-production.json --accepted-only --unavailable-out .obsidian-publish/unavailable-images.json
go run ./cmd/prepare-obsidian --accepted-only --state .obsidian-publish/accepted-production.json --mode production --unavailable-images .obsidian-publish/unavailable-images.json --out .obsidian-publish/production.json
```

Choose exactly one of `--source` and `--accepted-only`. Promotion inputs and outputs must be distinct bounded files below the ignored `.obsidian-publish/` directory; results and unavailable keys remain owner-only. Public command output contains only counts and byte totals. A content-only source outage retains the current deployment rather than entering this code-build fallback path.

Prepare production from a pinned source, authorize its effective image collection, promote with the separate source-read and media-write credentials, and then prepare again from the same pinned source. Missing or corrupt image originals/destinations mark only those references unavailable; credential failures block deployment. The second preparation removes unavailable references without changing the source revision or dropping valid post bodies. Never deploy the preliminary overlay after promotion reports unavailable references.

```sh
go run ./cmd/prepare-obsidian --r2 --state .obsidian-publish/accepted-production.json --mode production --out .obsidian-publish/production-before-promotion.json --source-out .obsidian-publish/pinned-production.json
node scripts/promote-obsidian-images.mjs --overlay .obsidian-publish/production-before-promotion.json --source .obsidian-publish/pinned-production.json
go run ./cmd/prepare-obsidian --source .obsidian-publish/pinned-production.json --state .obsidian-publish/accepted-production.json --mode production --out .obsidian-publish/production.json
```

The promotion command revalidates production authorization in Go before writing public objects. It checks accepted nondraft production content and actual used image references, validates one original at a time outside Go, and verifies SHA-256, MD5, size, MIME, and `public, max-age=31536000, immutable` destination metadata. Unchanged public images need metadata reads only. Configure `OBSIDIAN_MEDIA_ACCESS_KEY_ID` and `OBSIDIAN_MEDIA_SECRET_ACCESS_KEY` independently of the source credential. No routine promotion command deletes objects.

## Private archive and report commands

The private state adapter verifies explicit hashes and sizes on writes and reads, bounds object bodies, isolates state/report/archive key namespaces, and records safe R2 operation/byte counters. Provide state read/write credentials through `OBSIDIAN_STATE_ACCESS_KEY_ID` and `OBSIDIAN_STATE_SECRET_ACCESS_KEY`; the report reader instead uses the separate read-only `OBSIDIAN_REPORT` credential pair. Archive commands accept tested SHA-256 checksums and preserve exactly those archive bytes across job handoff:

```sh
node scripts/obsidian-private-storage.mjs upload --target staging --run 123-1 --checksum <tested-sha256> --file .obsidian-publish/tested.tar
node scripts/obsidian-private-storage.mjs download --target staging --run 123-1 --checksum <tested-sha256> --file .obsidian-publish/tested.tar
node scripts/obsidian-private-storage.mjs report --target production --file .obsidian-publish/production-report.json
node scripts/obsidian-private-storage.mjs report --target preview --pr 403 --file .obsidian-publish/pr-report.json
```

For a PR archive use `--target preview --pr <open-pr-number>`. Detailed reports remain in the private output file; command stdout contains operation status and counts. A 14-day lifecycle must target only `artifacts/`; it must exclude accepted state, candidate journals, reports, current verification receipts, and rollback records. Lifecycle provisioning and workflow handoff remain rollout tasks until verified against the account.

## Verification and recovery

Publication transactions journal the candidate, captured serving identity, and prior verified artifact before deployment. State is accepted only after exact artifact verification and a serving-identity check. Failed verification restores and verifies the captured prior version. Failed or unverified rollback leaves an incident journal and requires reconciliation; an orphan serving version is never accepted merely because it is live. Production, staging, and each PR use separate state namespaces.

The Cloudflare serving adapter validates account, target, Worker name, domain settings, and production's absence of runtime bindings in a retained checksummed archive before deployment. Its prior artifact must pass live checks before private uploads. Every enabled native PR alias and immutable deployment URL is authenticated and checked independently. Production verification includes exact public image bytes, MIME, length, and immutable cache headers. Subprocesses capture output and receive only credentials for their preparation, build, deployment, or verification purpose.

Production and staging rollback restore the captured Worker version at 100 percent traffic. Native preview rollback redeploys the exact prior archive, then records the new actual deployment ID and restores the matching prior accepted state after live verification. Private accepted-state backups and serving archives live under `rollback/`, outside the 14-day handoff lifecycle. A lost deployment or rollback response is reconciled using an opaque publication marker and full artifact verification; an unrelated live identity requires operator reconciliation. The archive parser rejects traversal, duplicate paths, links, unsupported metadata, malformed checksums, and incomplete data before extraction.

Measure runner duration, deployment frequency, no-op skips, retries, upload-to-verification latency, and Cloudflare operations for both targets. Reassess observed usage after two weeks and after publishing volume changes, considering GitHub Actions and Cloudflare Builds equally. Include private staging serving and build costs in that comparison.

## Workflow request validation and no-op preparation

`scripts/prepare-obsidian-target.mjs` connects private accepted state to the Go preparer. Run it after the target's job concurrency boundary and current-code checkout. It reconciles an interrupted journal, rejects unavailable/mismatched installed state or a serving-identity mismatch, then pins the current complete R2 source. It writes bounded owner-only inputs under `.obsidian-publish/hosted/<target>/` and emits only hashes, target, counts, and a preparation decision. Install required dependencies and complete any required full code-validation path before supplying credentials or preparing private content.

```sh
node scripts/prepare-obsidian-target.mjs --mode production --kind content --run 123-1
node scripts/prepare-obsidian-target.mjs --mode staging --kind site --run 123-1 --access .obsidian-publish/access-staging.json
node scripts/prepare-obsidian-target.mjs --mode preview --pr 403 --kind preview --run 123-1 --access .obsidian-publish/access-preview.json
```

Source-wide failure in a content-only run returns `retain-serving` and writes a protected degraded report without advancing accepted state or deploying. A code/PR build can instead return a revalidated accepted-only candidate. Explicit bootstrap is allowed only before accepted state exists and still requires a usable source; initial Git-only Worker/artifact bootstrap remains a separate operation. The command now finishes eligible production-image promotion and re-prepares from the same pinned source, or from accepted state with unavailable-image keys during a code-build source outage, before deciding whether a build is needed. An unchanged target verifies its retained artifact and returns `skip-build` with a sanitized receipt. Changed output returns `build-required` and an immutable checksummed private preparation handoff under `candidates/<target>/<run>/<checksum>.json`. The bundle includes the final candidate and protected diagnostics; target, exact code, source, state, effective digest, and run must correlate on both upload and download. It contains no tested build artifact and cannot authorize deployment on its own. Private Access gates, tested-archive checks, and publication verification still apply afterward. The multi-job Actions integration is pending. Supply `--run` explicitly for operator preparation; Actions defaults to its run ID and attempt.

The reusable workflow controls in `scripts/obsidian-workflow.mjs` validate site/content requests on main, resolve current main separately inside each target job, and validate an open same-repository PR's current head for manual refresh. Recheck that PR immediately before deployment; a closed PR, changed head, foreign repository, or Dependabot author cannot retain a private deployment grant. The production and staging plans use independent job concurrency groups, while PR refresh uses the existing preview/cleanup group. An informational requested source revision never becomes the publication source authority. Request admission is connected to the Actions workflow; resolution inside locked private target jobs and the deployment recheck remain pending.

Compatible code-check receipts live privately at `receipts/code/<commit>/<policy>.json`. The policy fingerprint covers the required ordered check set; a receipt must match the exact main commit, repository, policy, successful checks, workflow run, and original completion timestamp. Missing or incompatible receipts require all checks again. Unreadable private state stops the operation. The writer requires explicit success from every check and verifies the stored receipt before allowing reuse. Only trusted main workflow control code may execute these operations; the callback must run each actual check and propagate its failure.

Before frontend installation or full rendering, call the target transaction's `reconcileUnchanged` with its prepared state, code fingerprint, source revision, and effective-output digest. Matching code/output verifies the retained active artifact, rechecks its serving identity, and advances only that target's accepted reconciliation metadata while retaining the original artifact/archive/receipt. Changed output returns no skip result and follows the build path. Missing accepted state, cross-target preparation, failed verification, or changed live identity blocks acceptance. First-install bootstrap remains a separate explicit operation.

The portable recorder exposes this pre-build path with `--unchanged-only`. Its private candidate contains the prepared overlay under `verification.prepared`, accepted state, source revision, code SHA/fingerprint, and effective digest; a new artifact/archive is not required. It returns a sanitized verified skip receipt for unchanged output or `{ "version": 1, "target": "...", "status": "build-required" }` for changed output. Changed output remains queued in the protected report until the caller completes the tested-artifact build/publication path. Bootstrap cannot use this option.

```sh
node scripts/record-obsidian-publication.mjs --mode production --candidate .obsidian-publish/candidate.json --diagnostics .obsidian-publish/diagnostics.json --unchanged-only
```

## Private archive retention

The planned state-bucket lifecycle uses one rule named `obsidian-artifacts-14-days`, enabled only for the `artifacts/` prefix, with an age-based object deletion transition after 1,209,600 seconds. This is irreversible deletion of expired job handoff archives. Current state, accepted candidates, reports, receipts, journals, and retained rollback archives use other prefixes and must remain outside this rule. Source and media bucket lifecycle policies are separate. See [Cloudflare's lifecycle API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update/).

The reusable `configureArchiveLifecycle` operation is read-only by default. It preserves existing multipart-abort rules, rejects deletion policies that can affect retained publication state or expire archives sooner, requires review for a modified managed rule, and verifies the complete resulting configuration after an explicit apply. Live readback found only the default multipart-abort rule on all three buckets. Installing the archive rule is awaiting explicit approval; no object-expiration rule is active from this setup.

## Bucket-scoped credential setup

The current CLI OAuth session can provision Workers and Access but received HTTP 403 from the account API-token permission-group endpoint on 2026-10-04. An account owner must create the R2 credentials in the Cloudflare dashboard. Use [R2 API token management](https://developers.cloudflare.com/r2/api/tokens/) and select only the specified bucket for each credential. Give each token an explicit expiry, initially one year; preserve its expiry for rotation planning. Do not paste token values or S3 credentials into chat, repository files, Actions logs, or shell command arguments.

| Purpose / local setup kind | Bucket | R2 object permission | Consumer |
| --- | --- | --- | --- |
| `upload` | `justindfuller-obsidian-source` | Read and Write | Mac publisher only |
| `source-read` | `justindfuller-obsidian-source` | Read only | CI preparation and production image promotion reads |
| `media-write` | `justindfuller-obsidian-media` | Read and Write | Production image promotion only |
| `state-write` | `justindfuller-obsidian-state` | Read and Write | CI state, reports, journals, and private archives |
| `reports` | `justindfuller-obsidian-state` | Read only | Mac publisher and operator report reads |

In an interactive macOS terminal in the repository, run `node scripts/configure-obsidian-credential.mjs --kind <purpose>` separately for each row. The command prompts for the R2 Access Key ID and Secret Access Key with terminal echo disabled and stores the pair in macOS Keychain. It prints only the purpose and storage result. `upload` and `reports` use the publisher’s existing Cloudflare Keychain service; the three CI pairs use a separate operator service. This does not enable automatic dispatch or install the plugin. CI secret distribution and bucket-scope negative tests remain rollout steps.

Staging verification service credentials are already retained in a separate Keychain service, expire on 2027-10-04, and permit only their Service Auth policy. The staging human policy allows only the privately configured owner email, with email one-time PIN as the selected login method. New Zero Trust organizations do not automatically configure OTP; see [Cloudflare’s OTP setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/). The owner confirmed a successful browser OTP login and the exact staging sentinel on 2026-10-04.

Protected report reads verify target correlation, fingerprints, bounds, and receipt shape before saving diagnostics in ignored storage. Reads preserve the original report and verification timestamps. Output files are restricted to owner read/write and linked output paths are rejected. Go composite issue identities are converted to stable SHA-256 fingerprints at the protected-report boundary, preserving per-target notification deduplication without putting private paths in notice keys.

## Workflow request admission

The existing `cloudflare.yml` now declares `publish_kind` (`site`, `content`, or `preview`), informational `source_revision`, and optional `preview_pr`. Its request planner accepts production/staging requests only on `refs/heads/main`; preview refresh requires a canonical number and an open same-repository PR at its current head. Fork and Dependabot validation emits no private targets and performs no PR metadata reads. Requested source revisions are validated but are excluded from the plan so queued publishing can reconcile the latest complete revision.

The current Git-only deployment path has an explicit admission guard before dependency installation. Until the private multi-job pipeline is connected, content requests and manual preview refresh fail before deployment; they cannot accidentally deploy a Git-only production artifact or report that private content was published. Normal main site deployment and existing PR previews retain their existing path. This transitional guard is not completion of task 5.1. The private pipeline will consume the independent target plans under their concurrency groups and resolve current code again inside those boundaries.

## Tested private build handoff

After installing frontend and publisher dependencies on a fresh runner, supply state credentials and retrieve the exact preparation checksum for the same target, run, and code SHA. The build command checks the checkout before and after rendering, invokes the real Go exporter/Cloudflare builder with the final prepared overlay and a publication marker, validates production/staging deployment configuration with a dry run, and checks the complete archive's target boundary, marker, and rendered versus Worker asset bytes. Preview artifacts use `cf build --mode preview` plus the archive boundary checks; the installed Cloudflare CLI rejects regular deployment dry runs for preview output and exposes no preview-deploy dry-run option.

```sh
node scripts/build-obsidian-target.mjs --mode staging --run 123-1 --code-sha "$CODE_SHA" --preparation "$PREPARATION_SHA"
```

For preview builds, supply `--mode preview --pr <number>`; production uses `--mode production`. Build subprocesses receive the clean build environment without source, state, media, Access, or deployment credentials. Existing export validation checks links and target eligibility. Private runtime configuration must bind only assets and the private source bucket; production has no runtime bindings. Archive assets must match the rendered output in both directions.

Tested archives are immutable, checksummed, read back, and stored privately at `artifacts/<target>/<run>/<checksum>.tar`. A second protected bundle includes the final candidate, archive identity, and marker verification proof. The command returns only hashes, counts, target/run/code identity, and an opaque handoff checksum. It does not deploy or advance accepted state. The deployment step must retrieve those exact bytes, retain a verified copy under the candidate's `rollback/artifacts/` identity, and perform the existing gated publication transaction; those deployment-job connections remain pending. Public Actions artifact upload is never used by this command, including for private preview HTML.
