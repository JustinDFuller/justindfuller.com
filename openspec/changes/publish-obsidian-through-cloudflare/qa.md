# Cloudflare Obsidian Publishing QA

## Status

Implementation is incomplete. Local rendering has been exercised with the actual Agentic Spec-Driven Workflow post; hosted PR, staging, and production publication of that post remain pending. No private content has been uploaded to a hosted preview. The Mac plugin is packaged but has not been installed or enabled for automatic publishing.

## Local evidence

The original vault post body SHA-256 is `1ffaf67cfa6a531ef13c37f6a5ab44d67f4061b079aff4d72a0f7a2cf027177d`. Local preparation used a private copy with `environment: nonprod`; the vault file remained unchanged. Preparation found one Markdown source, 20 validated original images, 11 effective image references, and zero content issues.

The loopback preview returned HTTP 200 at `/programming/agentic-spec-driven-workflow`; all 11 image responses matched their SHA-256 records. HTML and image responses used private no-store caching. The browser displayed the post and its diagrams. Original body hash verification passed after rendering.

Go tests cover metadata eligibility, draft masks, fresh-runner fallback, demotion/deletion, collisions, rename handling, image syntax, safety, strict control documents, metadata-only R2 reads, and bounded response closing. Export integration checks the shared list/routes/sitemap collection and canary exclusion from every production file. The source reader rejects image-body GETs before invoking its transport.

Publisher tests cover complete private activation, partial upload isolation, unchanged scans, invalid image fallback, batching, restart retries, provider backoff, dispatch authentication, fixed trusted-main dispatch, protected-report deduplication, and separate target recovery. Private handler tests cover GET/HEAD, traversal/arbitrary-key rejection, unsupported methods, metadata corruption, bounded streaming, and private response headers. Transaction tests cover verified promotion, fresh-runner no-op proof, rollback, incident journals, ambiguous state writes, and per-PR state isolation.

Type checking and packaging passed on macOS ARM64; packaging loaded the included native Keychain binding and verified `AsyncEntry`. The script test suite passed with loopback permission. Go race tests passed across the full repository and again for the final changed packages, including the export-canary additions. The hosted-equivalent golangci-lint v2.9.0 reported zero issues. Strict OpenSpec and planning Markdown validation passed. Hosted checks will be recorded separately from local evidence.

## Infrastructure evidence

The three authorized Standard R2 buckets were created in ENAM on 2026-10-04. Readback reported `enabled: false` for each managed r2.dev domain. Source and state bucket custom domains are not configured by this implementation round. The media bucket remains private.

Staging build and deployment dry-run passed. Generated configuration names the separate staging Worker and domain, disables workers.dev and preview URLs, and includes only the private source binding plus assets. The production build and dry-run passed independently and reported no runtime bindings. Dry-run evidence is not hosted deployment evidence.

Cloudflare Access currently returns `access.api.error.not_enabled`. Activation remains pending; the owner confirmed the exact allowed email on 2026-10-04, and it is retained in ignored private provisioning input. Hosted private deployment must stay gated until Access application/policy checks and sentinel denial proofs succeed. Remaining implementation includes actual Actions reconciliation, hosted private archive handoff, protected report writes, credential provisioning, and hosted fault/privacy verification. The serving adapter is implemented; its deployment and recovery paths have controlled-transport evidence, with live read-only production metadata evidence recorded below.

## Storage and Access command round

The production preparation of the same unchanged post used a private copy with only its environment value changed. Go verified promotion authorization for all 11 effective images. Authorization rejects nonprod, draft, unused, and mismatched effective references even when the prepared digest is recomputed. Node promotion tests exercise separate private-source/public-media destinations, bounded original reads, byte/signature/hash verification, immutable public cache metadata, unchanged metadata-only checks, missing/corrupt-reference isolation, and credential failures that block deployment.

The private R2 state adapter verifies explicit body hashes and metadata across fresh transaction instances and rejects paths outside state/report/archive namespaces. Archive tests prove immutable checksummed handoff without public Actions artifacts. Access tests require exact owner and expiring service credentials, whole Worker destinations, complete bounded pagination, and denial before and after authenticated sentinel warmup. Missing Access, unsafe policies, overlapping applications, identity spoofing, and invalid service tokens fail closed. These tests use controlled transports and do not establish live account protection.

This round's combined Node suite passed 42 tests; TypeScript checking, changed-script ESLint, OpenSpec validation, and planning Markdown validation passed. New Go promotion authorization tests and race checks passed. The hosted-equivalent golangci-lint v2.9.0 reported zero issues. Protected verifier errors stay in ignored private files, private build output is captured, and staging deployment records use only the staging hostname. Hosted Go, golangci-lint, site, and preview checks passed for the resulting `3ef42ed` commit. The site/preview run was `37228354851`.

The actual post was also built through staging and production from separate private preparations. Both builds and deployment dry-runs passed; staging included the private source binding, production reported no runtime bindings and no private-image manifest entries. These operations uploaded no hosted private artifact. The original vault file matched its saved byte-for-byte baseline afterward, and the production-copy body hash matched `1ffaf67cfa6a531ef13c37f6a5ab44d67f4061b079aff4d72a0f7a2cf027177d`.

## Recovery and serving-adapter round

Explicit accepted-state fallback revalidates current target policy, Git ownership, raw content, per-file image history, and draft masks. Missing, cross-target, incompatible, or newly conflicting accepted state blocks deployment. Tests cover identical effective output during a source outage, preservation of two accepted revisions of the same logical image path, isolated unavailable references, and later recovery of those distinct image revisions through both accepted-only and normal source preparation. Unavailable image metadata remains private in accepted history and does not authorize promotion or rendering. The actual post's accepted production state revalidated to the same digest `7c3b2a3742679543cfd3b4b912990b17b256faa22136a86228de089e2d2f1606`, with one protected degraded-source issue and all 11 images retained.

Transaction recovery retains a private prior accepted-state snapshot, restores a native preview's matching prior state with its actual new deployment identity, reconciles lost deployment and rollback responses, rejects differing restored-artifact proof, and refuses to overwrite unrelated serving identities. Cloudflare adapter tests exercise whole Worker Access gates, unsafe-policy/URL rejection before upload, exact retained-archive restoration, all enabled preview URLs, production's 100-percent prior-version restoration, and incident recovery after lost responses. These deployment paths use controlled transports and have not yet been exercised against a hosted private deployment.

The new adapter's live read-only production metadata check passed on 2026-10-04: Worker platform ID `d682027a71cc49d0a463852e79f246fe`, serving version `ca28dd22-46df-43e1-99ac-5363ac23fc6c`, deployment `14ec3b7d-625a-4242-b373-488cbfed50d1`. The check performed two API reads and zero writes. This verifies the metadata response contract, not a publication or rollback.

Deterministic archive tests preserve private rendered HTML while excluding raw source/state credentials, verify checksums before extraction, and reject traversal, links, unsupported metadata, malformed/truncated entries, and linked destination directories. Retained serving archives use `rollback/` independently of expiring job handoff. Subprocess tests verify purpose-specific credential environments and suppression of private exception output. Public-media verifier regressions check exact image bytes, MIME, size, and immutable caching; altered bodies, cache policy, and MIME fail verification.

The actual unchanged post passed marked artifact builds and archive target-boundary validation for staging, native preview, and degraded production. Staging and production deployment dry-runs passed. The tested archives were approximately 103 MB each, including both generated static-output copies; this is local size evidence relevant to transfer/storage accounting. No hosted content was uploaded. Vault bytes still matched the original saved baseline, and the private production copy's body hash remained `1ffaf67cfa6a531ef13c37f6a5ab44d67f4061b079aff4d72a0f7a2cf027177d`.

Go unit/integration tests passed across the repository, changed Go race tests passed, and hosted-equivalent golangci-lint v2.9.0 reported zero issues. The final combined Node suite passed all 61 tests, including public-media verifier regressions. TypeScript checking, changed-script ESLint/Prettier, planning Markdown checks, strict OpenSpec validation, and diff checks passed. Hosted Go, golangci-lint, site, and native preview checks passed for commit `e4eafed`; the site/preview run was `37231785847`.

## Commit boundaries

Proposal commit: `331f4ff`, PR #402. Foundation implementation commit: `8d7eb4d`, PR #403, with hosted Go, lint, site, and preview checks green. Storage/Access command implementation: `3ef42ed`, with hosted checks green. Recovery and serving-adapter implementation: `e4eafed`, with hosted checks green. Protected diagnostics and publication status changes are being committed separately on `codex/publish-obsidian-cloudflare-implementation`; subsequent implementation and QA-only commits will be recorded as they are published.

## Protected diagnostics and status round

Go preparation now emits a protected report containing accepted file ownership, masks, and issues without post bodies or the raw accepted-state map. The actual unchanged post produced that report through accepted-only production preparation, retaining the previously verified source revision and effective digest.

The portable publication recorder writes per-target queued, verified, degraded, or failed reports around the publication transaction and whitelists public receipt correlation and provider operation counters. Tests verify that successful staging cannot clear a failed production report, private content and credentials cannot enter sanitized receipts, and a full 10,000-issue report still records deployment failure while retaining its diagnostics. Hosted use remains pending workflow integration and credentials.

Publisher status persists separate production and staging outcomes, ignores stale successful reports, retains actionable failure notices, and deduplicates repeated report-read failures separately for each target. Manual checks show both target statuses. Controlled asynchronous tests verify that pending report reads yield control.

All 47 Obsidian script/publisher tests and four recorder tests passed. Full repository Go tests, installed TypeScript checking, JavaScript ESLint, and hosted-equivalent golangci-lint v2.9.0 passed. The latest plugin package includes all three release files and its macOS ARM64 native binding exposes `AsyncEntry`; the plugin is not installed or enabled. Access was freshly checked on 2026-10-04 after refreshing the CLI session and still returned `access.api.error.not_enabled`. No private content was uploaded by this round.
