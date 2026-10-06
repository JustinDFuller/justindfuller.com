# Cloudflare Obsidian Publishing

Implementation and rollout are in progress. The proposal is `publish-obsidian-through-cloudflare`; its tasks remain the acceptance checklist. Existing Google/AWS resources remain available for separately reviewed retirement.

## Private boundaries

The three Standard R2 buckets are `justindfuller-obsidian-source`, `justindfuller-obsidian-media`, and `justindfuller-obsidian-state`. They were created with public r2.dev access disabled. The media bucket serves only promoted eligible production images through the active `media.justindfuller.com` custom domain; managed r2.dev access remains disabled. Source and state buckets remain private. Source Markdown, originals, snapshots, accepted state, reports, and private build archives must remain authenticated.

Staging uses a separate `justindfuller-site-staging` Worker at `staging.justindfuller.com`, with workers.dev and version preview URLs disabled. Nonproduction images use `/__obsidian/media/v1/<sha256>.<extension>` and a deployment-specific allowlist. The handler can read only those image keys, checks metadata, bounds streamed responses, and rejects arbitrary source objects. Production has no private-source runtime binding or image handler.

Before uploading any private hosted artifact, activate Cloudflare Access and configure an exact owner identity. Protect staging with a Worker destination and the production Worker's previews with a `preview_worker` destination. Separate CI Service Auth credentials must have an expiry. Verify anonymous and invalid-token denial on all enabled aliases and immutable URLs using nonsensitive sentinels, then repeat denial checks after authenticated requests. Noindex and private caching accompany Access; authentication is the privacy boundary.

The source uploader requires only source-bucket object read/write. CI source reads, media promotion, state/archive writes, protected report reads, deployment, and Access verification use distinct credentials. R2 object write permissions also permit deletion; the publisher and routine promotion path must never delete. Preserve existing production deployment authority and scope staging authority separately using the narrowest Cloudflare-supported permissions. Do not change zone-wide security settings for this rollout.

## Access provisioning gate

Zero Trust onboarding was verified on 2026-10-04. Staging was initially provisioned with a sentinel-only Worker, custom domain, exact owner policy, and expiring Service Auth credential; its live denial and authenticated sentinel checks passed. The private test post was subsequently published and verified as recorded below. On 2026-10-05, production-Worker preview protection was configured with Access application `7afedc6c-27bb-4755-b3c0-6eb4ef4438c8`, exactly one `preview_worker` destination for Worker `d682027a71cc49d0a463852e79f246fe`, an owner-only Allow policy, and separate expiring Service Auth credentials. Live checks against PR 403's existing Git-only bytes passed for the stable alias and both immutable preview aliases: authenticated requests returned the expected bytes, while anonymous, spoofed-identity, and invalid-token requests were denied before and after authenticated warmup. This verifies Access against the existing Git-only preview baseline; it is not sentinel-only deployment evidence or proof of private-content publication. The proof is retained in `.obsidian-publish/access/preview-access-proof.json`. The CI preview Access gate is enabled, while private publishing remains disabled. The `obsidian-publish` environment is restricted to the `main` branch, with no tag refs allowed. Worker IDs are platform IDs, not Worker names. These destinations cover the Worker's alternate domains and native previews; see [Cloudflare's Worker Access documentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

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

The first command reads all Access application/policy pages and service token metadata, checks the exact destination and identity boundaries, and requires anonymous, spoofed-identity, and invalid-service-token denial before and after an authenticated exact-byte sentinel request. It fails before private upload when any enabled hostname lacks proof. The live verifier repeats configuration checks and denial around authenticated HTML, redirects, assets, sitemap, and allowlisted image requests; private failures are written to ignored local verification data while public output contains counts only. The existing PR 403 Git-only aliases have passed separate authenticated-byte and denial checks under the production Worker preview Access policy. Private preview publication and its corresponding verifier wiring remain pending; the Git-only checks do not prove private-content deployment.

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

## Two-week cost and latency reassessment

Start the observation window when the main-ref Actions pipeline is available and a hosted staging/production reconciliation succeeds. Keep automatic dispatch disabled until rollout acceptance is complete. Record the source activation time and each target's verified time separately; operator transaction time does not establish edit-to-publication latency or hosted runner consumption.

For each changed publication, no-op, retry, and code-only run, retain a sanitized row containing target, source/code hashes, run ID, queue delay, job durations, rounded billable minutes, build/deploy decision, transaction duration, and verification result. Include staging and PR work as well as production, and count failed attempts. Record GitHub's actual billing/usage view separately from total runner minutes: included or zero-priced runs still consume finite runtime/concurrency and may delay other work.

| Measure | Evidence to collect during the window |
| --- | --- |
| GitHub Actions | Per-job durations and billing rounding, account allowance, concurrency/queue delay, retries, artifact storage, changed/unchanged frontend installation |
| Cloudflare Builds | Account entitlement, included/charged minutes, concurrency/queue delay, equivalent trusted orchestration and private-artifact support |
| R2 | Account-wide GB-month storage, Class A/B operations, shared remaining allowance, archive expiry, rollback growth, promotion and report reads |
| Private serving | Staging/PR requests, Worker CPU and billed usage, Access seats/plan eligibility, authenticated traffic versus rejected traffic |
| Publishing latency | Source activation to verified production/staging separately, median and slowest observed timings, failure recovery time |

At days seven and fourteen, aggregate changed/skipped/retried counts by target and review queue delays and storage growth. Compare GitHub Actions and Cloudflare Builds using the same number of publications, target matrix, security boundaries, retained artifacts, and retry rate. Add the cost of keeping private staging available in both cases. Use current official prices and the account's actual entitlements; do not treat an unused allowance as exclusive to this repository. Choose a change only when observed cost, latency, reliability, or maintenance effort justifies it, with neither provider preselected for the reassessment.

The metadata-only bucket sample at 2026-10-06T07:16:40.646Z measured 1,570,424,294 bytes across the three publishing buckets: source 2,094,088 bytes, public media 2,056,897 bytes, and state 1,566,273,309 bytes. State included 617,332,736 bytes under temporary `artifacts/` and 927,122,890 bytes under retained `rollback/`. This is instantaneous stored size, not account-wide allowance or monthly billable GB-month usage. Each unique tested build adds roughly 103 MB of archive data; rollback copies do not expire under the approved archive-only lifecycle. The sample used three list requests, read no object bodies, and made no writes. Its ignored proof is `.obsidian-publish/access/storage-baseline-2026-10-06.json`.

Observed operator transaction times were 57,038 ms for trusted staging publication, 84,116 ms for private PR publication, 41,843 ms for production publication, and 20,425 ms for staging's unchanged reconciliation. The unchanged reconciliation made no deployment attempts but still performed verification and state operations. Eleven repeat public image GETs were CDN HITs. These measurements provide a baseline; hosted job minutes, complete upload-to-verification latency, private-serving billing, account-wide remaining allowance, and Cloudflare Builds entitlement remain unmeasured. Task 6.5 stays open until those fields are evidenced.

## Workflow request validation and no-op preparation

`scripts/prepare-obsidian-target.mjs` connects private accepted state to the Go preparer. Run it after the target's job concurrency boundary and current-code checkout. It reconciles an interrupted journal, rejects unavailable/mismatched installed state or a serving-identity mismatch, then pins the current complete R2 source. It writes bounded owner-only inputs under `.obsidian-publish/hosted/<target>/` and emits only hashes, target, counts, and a preparation decision. Install required dependencies and complete any required full code-validation path before supplying credentials or preparing private content.

```sh
node scripts/prepare-obsidian-target.mjs --mode production --kind content --run 123-1
node scripts/prepare-obsidian-target.mjs --mode staging --kind site --run 123-1 --access .obsidian-publish/access-staging.json
node scripts/prepare-obsidian-target.mjs --mode preview --pr 403 --kind preview --run 123-1 --access .obsidian-publish/access-preview.json
```

Source-wide failure in a content-only run returns `retain-serving` and writes a protected degraded report without advancing accepted state or deploying. A code/PR build can instead return a revalidated accepted-only candidate. Explicit bootstrap is allowed only before accepted state exists and still requires a usable source; initial Git-only Worker/artifact bootstrap remains a separate operation. The command now finishes eligible production-image promotion and re-prepares from the same pinned source, or from accepted state with unavailable-image keys during a code-build source outage, before deciding whether a build is needed. An unchanged target verifies its retained artifact and returns `skip-build` with a sanitized receipt. Changed output returns `build-required` and an immutable checksummed private preparation handoff under `candidates/<target>/<run>/<checksum>.json`. The bundle includes the final candidate and protected diagnostics; target, exact code, source, state, effective digest, and run must correlate on both upload and download. It contains no tested build artifact and cannot authorize deployment on its own. Private Access gates, tested-archive checks, and publication verification still apply afterward. The reusable Actions workflow implements preparation, isolated rendering, immutable artifact handoff, and deployment as separate jobs; private publishing remains disabled until credentials, verified bootstrap receipts, and hosted validation are ready. Supply `--run` explicitly for operator preparation; Actions defaults to its run ID and attempt.

The reusable workflow controls in `scripts/obsidian-workflow.mjs` validate site/content requests on main, resolve current main separately inside each target job, and validate an open same-repository PR's current head for manual refresh. Recheck that PR immediately before deployment; a closed PR, changed head, foreign repository, or Dependabot author cannot retain a private deployment grant. The production and staging plans use independent job concurrency groups, while PR refresh uses the existing preview/cleanup group. An informational requested source revision never becomes the publication source authority. Request admission, resolution inside locked private target jobs, and the deployment recheck are connected to the reusable Actions workflow. Hosted execution remains unverified.

Compatible code-check receipts live privately at `receipts/code/<commit>/<policy>.json`. The policy fingerprint covers the required ordered check set; a receipt must match the exact main commit, repository, policy, successful checks, workflow run, and original completion timestamp. Missing or incompatible receipts require all checks again. Unreadable private state stops the operation. The writer requires explicit success from every check and verifies the stored receipt before allowing reuse. Only trusted main workflow control code may execute these operations; the callback must run each actual check and propagate its failure.

Before frontend installation or full rendering, call the target transaction's `reconcileUnchanged` with its prepared state, code fingerprint, source revision, and effective-output digest. Matching code/output verifies the retained active artifact, rechecks its serving identity, and advances only that target's accepted reconciliation metadata while retaining the original artifact/archive/receipt. Changed output returns no skip result and follows the build path. Missing accepted state, cross-target preparation, failed verification, or changed live identity blocks acceptance. First-install bootstrap remains a separate explicit operation.

The portable recorder exposes this pre-build path with `--unchanged-only`. Its private candidate contains the prepared overlay under `verification.prepared`, accepted state, source revision, code SHA/fingerprint, and effective digest; a new artifact/archive is not required. It returns a sanitized verified skip receipt for unchanged output or `{ "version": 1, "target": "...", "status": "build-required" }` for changed output. Changed output remains queued in the protected report until the caller completes the tested-artifact build/publication path. Bootstrap cannot use this option.

```sh
node scripts/record-obsidian-publication.mjs --mode production --candidate .obsidian-publish/candidate.json --diagnostics .obsidian-publish/diagnostics.json --unchanged-only
```

## Private archive retention

The state-bucket lifecycle has one rule named `obsidian-artifacts-14-days`, enabled only for the `artifacts/` prefix, with an age-based object deletion transition after 1,209,600 seconds. This is irreversible deletion of expired job handoff archives. Current state, accepted candidates, reports, receipts, journals, and retained rollback archives use other prefixes and remain outside this rule. Source and media bucket lifecycle policies are separate. See [Cloudflare's lifecycle API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update/).

The reusable `configureArchiveLifecycle` operation is read-only by default. It preserves existing multipart-abort rules, rejects deletion policies that can affect retained publication state or expire archives sooner, requires review for a modified managed rule, and verifies the complete resulting configuration after an explicit apply. On 2026-10-05, the `obsidian-artifacts-14-days` rule was applied to the state bucket and read back as enabled for only the `artifacts/` prefix with a 1,209,600-second maximum age. The 14-day expiry is now active for tested build handoffs; rollback archives and other retained publication state remain outside its prefix.

## Bucket-scoped credential setup

The current CLI OAuth session can provision Workers and Access but cannot create R2 credentials: the user-token endpoint returned HTTP 403 code 9109 on 2026-10-05, while permission-group discovery succeeded. On 2026-10-05, an account owner created all five bucket-scoped credentials through the Cloudflare dashboard. Each was stored in its designated Keychain service and read back successfully, with expiry on 2027-10-05. Live S3 list checks confirmed each credential can read its intended bucket and received HTTP 403 on both other buckets, for 15 successful scope checks total. Use [R2 API token management](https://developers.cloudflare.com/r2/api/tokens/) for future credential rotation, selecting only the specified bucket for each credential. Do not paste token values or S3 credentials into chat, repository files, Actions logs, or shell command arguments.

| Purpose / local setup kind | Bucket                          | R2 object permission | Consumer                                            |
| -------------------------- | ------------------------------- | -------------------- | --------------------------------------------------- |
| `upload`                   | `justindfuller-obsidian-source` | Read and Write       | Mac publisher only                                  |
| `source-read`              | `justindfuller-obsidian-source` | Read only            | CI preparation and production image promotion reads |
| `media-write`              | `justindfuller-obsidian-media`  | Read and Write       | Production image promotion only                     |
| `state-write`              | `justindfuller-obsidian-state`  | Read and Write       | CI state, reports, journals, and private archives   |
| `reports`                  | `justindfuller-obsidian-state`  | Read only            | Mac publisher and operator report reads             |

For future setup or rotation, run `node scripts/configure-obsidian-credential.mjs --kind <purpose>` in an interactive macOS terminal in the repository. The command prompts for the R2 Access Key ID and Secret Access Key with terminal echo disabled and stores the pair in macOS Keychain. It prints only the purpose and storage result. `upload` and `reports` use the publisher’s existing Cloudflare Keychain service; the three CI pairs use a separate operator service. On 2026-10-05, after explicit owner authorization, the three CI R2 pairs, two Access Service Auth pairs, and two private Access configurations were stored as twelve encrypted secrets in the `obsidian-publish` GitHub environment. Readback verified the secret names and the exact main-only branch restriction with no tags; values were never printed. Negative object-write scope tests remain rollout steps. This does not enable automatic dispatch or install the plugin.

Staging verification service credentials are already retained in a separate Keychain service, expire on 2027-10-04, and permit only their Service Auth policy. The staging human policy allows only the privately configured owner email, with email one-time PIN as the selected login method. New Zero Trust organizations do not automatically configure OTP; see [Cloudflare’s OTP setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/). The owner confirmed a successful browser OTP login and the exact staging sentinel on 2026-10-04.

Protected report reads verify target correlation, fingerprints, bounds, and receipt shape before saving diagnostics in ignored storage. Reads preserve the original report and verification timestamps. Output files are restricted to owner read/write and linked output paths are rejected. Go composite issue identities are converted to stable SHA-256 fingerprints at the protected-report boundary, preserving per-target notification deduplication without putting private paths in notice keys.

## Workflow request admission

The existing `cloudflare.yml` now declares `publish_kind` (`site`, `content`, or `preview`), informational `source_revision`, and optional `preview_pr`. Its request planner accepts production/staging requests only on `refs/heads/main`; preview refresh requires a canonical number and an open same-repository PR at its current head. Fork and Dependabot validation emits no private targets and performs no PR metadata reads. Requested source revisions are validated but are excluded from the plan so queued publishing can reconcile the latest complete revision.

The private pipeline is gated by `OBSIDIAN_PUBLISH_ENABLED`. While disabled, content requests and manual private preview refresh fail before deployment, and main site deployment uses the existing Git-only path. `OBSIDIAN_PREVIEW_ACCESS_ENABLED` separately disables the legacy unauthenticated preview verifier after Access protection is enabled. Private publishing resolves current code inside each target concurrency boundary and validates preview admission again immediately before deployment. The workflow is implemented; task 5.1 still requires hosted execution proof.

## Tested private build handoff

After installing frontend and publisher dependencies on a fresh runner, supply state credentials and retrieve the exact preparation checksum for the same target, run, and code SHA. The build command checks the checkout before and after rendering, invokes the real Go exporter/Cloudflare builder with the final prepared overlay and a publication marker, validates production/staging deployment configuration with a dry run, and checks the complete archive's target boundary, marker, and rendered versus Worker asset bytes. Preview artifacts use `cf build --mode preview` plus the archive boundary checks; the installed Cloudflare CLI rejects regular deployment dry runs for preview output and exposes no preview-deploy dry-run option.

```sh
node scripts/build-obsidian-target.mjs --mode staging --run 123-1 --code-sha "$CODE_SHA" --preparation "$PREPARATION_SHA"
```

For preview builds, supply `--mode preview --pr <number>`; production uses `--mode production`. Build subprocesses receive the clean build environment without source, state, media, Access, or deployment credentials. Existing export validation checks links and target eligibility. Private runtime configuration must bind only assets and the private source bucket; production has no runtime bindings. Archive assets must match the rendered output in both directions.

Tested archives are immutable, checksummed, read back, and stored privately at `artifacts/<target>/<run>/<checksum>.tar`. A second protected bundle includes the final candidate, archive identity, and marker verification proof. The command returns only hashes, counts, target/run/code identity, and an opaque handoff checksum. It does not deploy or advance accepted state. Public Actions artifact upload is never used by this command, including for private preview HTML.

## Deploy an exact tested artifact

After the build job returns its handoff checksum, the deployment job checks out the same commit, supplies the same target and run, and invokes the deployment command with state and Cloudflare credentials. It downloads the correlated preparation bundle and exact archive bytes, verifies their checksum, size, target configuration, and publication marker, then stores and reads back the immutable rollback copy before starting the publication transaction. For preview, it also reads the current PR and requires the same open same-repository head immediately before the transaction.

```sh
node scripts/deploy-obsidian-target.mjs --mode staging --run 123-1 --code-sha "$CODE_SHA" --preparation "$TESTED_HANDOFF_SHA"
```

For production use `--mode production`; for a preview use `--mode preview --pr <number>`. Pass the prepared Access configuration with `--access .obsidian-publish/access-staging.json` or the target-specific equivalent when required. First deployment requires the explicit `--bootstrap` flag and a verified `--bootstrap-receipt` from the existing bootstrap process. The command passes the exact run to the recorder so the resulting receipt is correlated with its tested artifact. It prints only the sanitized receipt and reports transaction failure through the protected report and journal.

Deployment-command unit tests exercise all three target modes and injected failures for mismatched target/run/artifact, altered bytes, archive marker mismatch, changed checkout, stale/closed preview PR, conflicting rollback archive, failed readback, and live verification rollback. These controlled transport tests establish local transaction behavior only. Actual tested-artifact deployment through hosted Actions, live R2 handoff, and hosted Cloudflare post-verification are still pending; do not count these tests as live Cloudflare deployment proof.

## Capture a verified bootstrap artifact

Before the first private publication, retain a verified nonsensitive artifact for that target. `captureBootstrapReceipt` in `scripts/capture-obsidian-bootstrap.mjs` accepts an operator-produced archive Buffer, its SHA-256, the exact mode/PR, and the existing private store and Cloudflare serving adapters. It validates the archive's account and target, retains an immutable copy under `rollback/artifacts/<target>/<checksum>.tar`, requires exact readback, verifies the archive against the current live deployment through `CloudflareServing.verify(receipt)`, and rechecks serving identity before returning the receipt. Save that receipt through `saveProtectedReport` under `.obsidian-publish/` and provide it only to the corresponding initial publication. The helper does not deploy, initialize accepted state, or enable publishing.

A rebuilt Git-only artifact is a candidate until its bytes match a verified live deployment. An old deployment identifier, a successful dry run, or an Access sentinel response cannot establish that correlation. If the candidate differs from live, first establish and verify a separate nonsensitive baseline deployment while retaining the prior Cloudflare version for recovery; capture its receipt afterward. Keep automatic publishing disabled until target-specific baseline receipts and credential boundaries are ready.

### Trusted runtime for private builds

Staging and PR static rendering can execute target code in the isolated renderer, but runtime access to the private source bucket belongs to trusted workflow control code. After validating rendered assets, the trusted uploader independently compiles the fixed private Worker from its own locked control checkout and injects only the authoritative preparation image allowlist. It replaces all rendered Worker modules and deployment configuration, removes extra Worker output, and records control revision, module, configuration, and allowlist hashes in the private handoff. The deployment runner independently repeats this compilation and requires exact bytes and the matching proof before retaining or deploying a new private artifact. The default control workspace comes from the helper's own location, never the target working directory. Production continues to have no private-source runtime binding. Historical immutable receipts are checked against their retained hashes so a later control revision does not invalidate a verified rollback archive.

## Current operator rollout status

The trusted private Worker was published and verified on persistent staging from commit `5e481892e33eb4ea398f92fba9aecc44d84478f0` on 2026-10-05 (America/New_York). Accepted state readback matched the final tested artifact, serving version, and trusted control attestation. A subsequent unchanged-content reconciliation verified the same deployment and skipped both rendering and deployment. Anonymous, spoofed-owner, and invalid-service-token requests remained denied after authenticated warmup. These are operator-orchestrated Cloudflare/R2 results; hosted Actions execution remains unverified.

The empty media bucket was attached to `media.justindfuller.com` with domain-local minimum TLS 1.2, while r2.dev remained disabled. Certificate and ownership readback are now active. All eleven eligible production test-post images passed exact byte/hash/MIME checks and one-year immutable response-header checks; repeat GETs were CDN HITs for all eleven. Source-shaped paths returned 404 on the media domain. Source and state buckets remain private. Automatic publishing remains disabled pending hosted rollout validation. Permanent staging deployment and Access-read CI credentials were created, scope-checked, and stored on 2026-10-06. Verified bootstrap receipts now exist for staging, PR 403, and production; operator publication is accepted in each target.

The unchanged test post is verified in the protected PR 403 preview and on both public production hostnames. PR publication used its nonprod private copy; production used a private copy whose sole metadata change was `environment: prd` to the required `environment: production`. At that initial validation, the original vault note remained byte-for-byte unchanged. On 2026-10-06, its actual vault target was migrated from `prd` to `production`; the body stayed byte-for-byte unchanged, and no other notes were modified. Before either initial transaction, the exact historical public Actions artifact was recovered with matching deployment provenance, its supported archive container was reconstructed without changing any file bytes, and live artifact verification established a retained rollback baseline. These operator results do not enable automatic dispatch or prove hosted Actions reconciliation.

## Permanent CI token verification on 2026-10-06

The owner approved two new one-year account API tokens. `Obsidian staging deployment` grants only Individual Workers Editor for the existing `justindfuller-site-staging` Worker, without account-wide Worker or zone permissions. A live settings read succeeded for staging and returned HTTP 403 for production. `Obsidian Access verification read-only` grants only Access Apps and Policies Read plus Access Service Tokens Read for the account; the existing verification gate passed for both staging and preview configurations. Both tokens are active and expire at 2027-10-06T23:59:59Z. This proves the configured scope and read/gate behavior; deployment using the new staging token remains a separate rollout check.

The tokens were saved and read back under Keychain service `com.justindfuller.obsidian-cloudflare.credentials`, accounts `staging-deploy` and `access-read`. After rechecking the exact main-only branch rule with no tags, they were transferred via stdin to `CLOUDFLARE_STAGING_API_TOKEN` and `CLOUDFLARE_ACCESS_API_TOKEN` in GitHub's `obsidian-publish` environment. Secret-name readback confirmed both values were stored. The original twelve approved environment values remain in place, and the existing production credential was unchanged. One-time token values were never printed; temporary owner-only copies were removed after Keychain readback. Ignored proof is `.obsidian-publish/access/new-ci-token-distribution-proof.json`. Automatic publishing stays disabled until hosted acceptance.

## Staging deployment without domain reconciliation

After the staging Worker and its custom domain have been provisioned, routine publication uploads the tested prebuilt output with `cf workers versions create --prebuilt --mode staging`. The deployment adapter requires exactly one valid uploaded version ID, assigns only that version 100 percent of traffic through the existing Worker's deployment endpoint, and verifies that serving metadata names the uploaded version. It preserves the existing domain/trigger configuration and needs no zone permission. Production and native PR deployment commands retain their existing behavior. Missing, malformed, or ambiguous CLI version output blocks the traffic write; a serving identity mismatch enters the existing verified rollback/reconciliation path.

## Bounded build archives

New builds use a deterministic compressed archive with identical file payloads stored once. The measured current build shrank from 102,906,880 bytes to 44,873,303 bytes (56.4%). Legacy tar archives remain readable. The `.tar` object suffix remains an opaque historical name; readers identify the format from its bytes and verify the stored-byte checksum before decompression.

Tested handoff and rollback share one canonical `rollback/artifacts/<target>/<checksum>.tar` object, avoiding a second full copy for every publish. After verified publication, cleanup runs inside the target's deployment concurrency boundary. It preserves all current accepted-state and active-journal archive references, then retains at most three extra unreferenced archives per target for at most 14 days. It rechecks state before each deletion and fails closed on malformed or changed state. Cleanup failures are reported separately from publication success. Historical receipts do not guarantee indefinite access to their old build archives. Source snapshots, Markdown, public media, reports, accepted-state backups, and other state remain untouched.

The existing 14-day `artifacts/` lifecycle still expires legacy handoff copies. Existing stored archives are not rewritten into the new format; storage falls as eligible old archives are cleaned up and legacy handoffs expire. Source revision retention is a separate concern, so this policy bounds build archives per target rather than every object in the account. Operator publication and maintenance must use the same exclusive target boundary as hosted deployment; do not run concurrent operator publishes or cleanup for one target.

A fresh metadata-only sample at 2026-10-06T11:53:58.925Z measured 1,871,362,614 bytes across the three buckets: 823,146,496 bytes of legacy temporary archives, 1,002,399,456 bytes of rollback archives, 41,665,677 bytes of other state, and 4,150,985 bytes of source and public media. Four compressed rollback archives were stored at their actual approximately 44.9 MB sizes; eight legacy rollback archives remained at approximately 103 MB each. Current retention plans required no additional deletion and protected two references per target, with two extra production archives, three extra staging archives, and one extra PR 403 archive. At the measured compressed size, two protected references plus three extra archives would occupy approximately 225 MB per target once legacy versions rotate out; additional PR targets and source/state history remain separate contributors. This is an illustration using the current build size and reference count, not a universal byte cap. The ignored proofs are `.obsidian-publish/access/storage-detailed-after-reduction-2026-10-06.json`, `.obsidian-publish/access/storage-object-size-distribution-2026-10-06.json`, and `.obsidian-publish/access/archive-retention-dry-run-proof.json`.

## Current four-environment operator validation

Implementation `3cb6b33` passed local tests and hosted CI, then served the authorized post successfully through localhost, private staging, protected PR 403, and production on 2026-10-06. Each hosted target completed exact-byte verification with zero failures; staging used only the approved Worker-scoped deployment token and read-only Access token, and production used the existing operator authority. These are live operator deployments of the tested implementation, not proof of GitHub Actions private publication. Automatic publishing remains disabled.

The actual vault post now uses `environment: production`, with its original body SHA-256 unchanged. Localhost checked the post, all 11 image GET/HEAD responses, private headers, and three disallowed source paths, then both loopback listeners were stopped. Staging and PR separately denied anonymous, spoofed-identity, and invalid-token requests after authorized warmup. Production verified both public hostnames and all 11 already promoted images without copying new media. Native plugin installation/enablement, the full hosted fault matrix, main-workflow availability, and final stack/archive work remain pending.
