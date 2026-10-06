# Cloudflare Obsidian Publishing Tasks

## 1. Source protocol and reusable validation

- [x] 1.1 Extract PR #390's source-independent metadata, Markdown, image-reference, and merge logic into current main; verify add/overwrite collisions, drafts, unsafe HTML, escaped/balanced image destinations, and code fences without Google or App Engine wiring.
- [x] 1.2 Implement the strict nonprod/production post enum, separate deployment modes, and explicit legacy metadata migration/check; verify the target eligibility matrix, rejected aliases, draft exclusion, promotion, and demotion before fallback with focused tests.
- [x] 1.3 Implement the version-1 private R2 source snapshot and metadata-only Go image reader; verify canonical hashes, pinned reads, path/schema limits, explicit image metadata, missing objects, and zero Go image-body requests with transport tests.
- [x] 1.4 Implement durable accepted-state serialization, current-code/target revalidation, isolated production/staging/PR/local state, and interruption journals; verify fresh-runner fallback, invalid revisions, removal/rename, ownership changes, collisions, demotion, and ambiguous promotion recovery.

## 2. Mac publishing and status

- [x] 2.1 Extend the plugin to upload Markdown and all validated image originals to private source storage and activate complete snapshots; verify partial uploads never change the active pointer, invalid Markdown remains represented, invalid images are isolated, the Mac never writes public media, and unchanged scans perform no writes.
- [x] 2.2 Add R2 destination settings and separate asynchronous Keychain entries for upload, GitHub dispatch, and protected-report read credentials; verify packaging, native binding load, plugin identity compatibility, and absence of secrets in settings, logs, and manifests.
- [x] 2.3 Add the 60-second debounce, maximum batch age, five-minute reconciliation, manual publish, persisted dispatch retries, and fixed main-workflow target; verify batching, restart recovery, provider backoff, authentication failures, and no periodic unchanged dispatches using fake clocks and transports.
- [ ] 2.4 Add target-specific protected publication-status reads and deduplicated issue/recovery notices; verify uploaded/queued/verified/degraded states remain distinct, staging success does not clear production failure or vice versa, and Obsidian remains responsive during credential prompts and retries.

## 3. Static rendering and portable commands

- [x] 3.1 Add a prepared-overlay input and one effective programming collection shared by handlers, export paths, lists, and sitemap generation; verify deterministic per-target output, draft-mask 404s, overwrite deletion/demotion fallback, nonprod exclusion from every public route/list/feed, and unaffected homepage features.
- [x] 3.2 Add portable prepare, export, diagnostics-read, and publication-record commands plus explicit local modes; verify fixture-based local rendering, Git-only operation, ignored private local state, loopback-only listeners, and the existing Cloudflare verifier against generated output.
- [x] 3.3 Implement production-only image promotion and destination verification; verify only effective accepted nondraft production references authorize copying, unique nonprod/draft images stay out of public storage, missing images remain isolated, and no Go image bodies are read.
- [x] 3.4 Implement the same-origin private preview image handler and loopback dev gateway with deployment-specific image allowlists; verify bounded streaming, GET/HEAD behavior, unsupported methods, hash/path traversal rejection, inability to fetch Markdown/manifests, and absence of private runtime bindings/routes in production.
- [ ] 3.5 Add public-output/log/artifact privacy checks and private preview archive storage; verify canary nonprod/draft text, private filenames/slugs, source snapshots, overlays, state, reports, and secrets are absent from public exports, logs, summaries, comments, and Actions archives while private preview HTML is preserved in authenticated storage.

## 4. Staging and Access boundaries

- [x] 4.1 Add a separate staging Worker configuration and documented `staging.justindfuller.com` deployment target with workers.dev/version URLs disabled; verify production routing remains public and staging survives PR cleanup independently.
- [ ] 4.2 Add provisioning/configuration documentation for whole-staging-Worker Access and production-Worker preview Access, exact owner identity, and separate expiring CI Service Auth credentials; verify sentinel-only destinations deny anonymous/disallowed access across all enabled aliases and immutable URLs before private uploads, without a public bypass policy.
- [ ] 4.3 Add deployment gates checking required Access applications/policies/destinations and extend verification for authenticated requests plus anonymous/invalid-token denial; verify missing protection blocks private uploads, spoofed identity headers do not authorize access, and authorized cache warmup does not expose bodies to denied clients.
- [ ] 4.4 Apply private no-store/noindex behavior to staging/PR HTML, assets, sitemap/feed output, and private image responses; verify response headers and denied-body behavior for each resource type while production cache behavior remains unchanged.

## 5. GitHub Actions integration

- [ ] 5.1 Extend the workflow with content dispatch reconciling staging and production, validated manual PR refresh, source preparation, and per-target no-op checks; verify main-ref enforcement, current-main checkout, code-validation receipt gating, skipped frontend installation on unchanged targets, nonprod-only staging deployment, and credential-free fork/Dependabot paths.
- [ ] 5.2 Keep production code/content publication in its shared concurrency group, staging in its own group, and preview/cleanup work in the corresponding PR group; verify queued requests reconcile current main/latest source inside each boundary and cannot restore stale content or cross target state.
- [ ] 5.3 Add authenticated, checksummed R2 handoff for staging/PR tested archives and a 14-day archive-only lifecycle; verify public artifacts contain only eligible production assets/sanitized receipts, exact private artifacts are deployed, and lifecycle rules retain current state and rollback records.
- [ ] 5.4 Preserve tested-artifact deployment and exact-byte verification while adding per-target private journals, state promotion, and prior-version rollback; verify failed builds leave serving identities unchanged, failed checks attempt verified rollback, ambiguous writes remain unaccepted, and staging failures do not roll back successful production.
- [ ] 5.5 Add sanitized target-specific receipts and resource counters; verify source/code/artifact/deployment correlation, runner durations, additional staging work, skips, retries, R2/Worker usage, and end-to-end latency evidence without private source information.

## 6. Infrastructure and rollout evidence

- [ ] 6.1 Document provisioning for the three R2 buckets, bucket-scoped publisher/promotion/state/report credentials, separate staging deployment authority, and public media domain; verify source/state anonymous reads fail, only eligible images are public, r2.dev is disabled, public image caching is correct, and production DNS/deployment authority is preserved.
- [ ] 6.2 Run relevant Go unit/integration/race tests, publisher tests/type checking/packaging, changed-script lint, Markdown checks, strict OpenSpec validation, and production/staging dry-run checks; record results and implementation versus QA commit boundaries in QA documentation.
- [ ] 6.3 Exercise hosted persistent staging and a protected same-repository PR with valid/invalid posts, both targets, draft masks, promotion/demotion, deletions, missing images, fresh-runner fallback, and controlled rollback faults; verify owner/service access, anonymous denial, private artifact/media exclusion, target isolation, and zero Go image-body requests.
- [ ] 6.4 Reconcile local/retained-provider content and migrate metadata, then manually reconcile staging and production after main's workflow is available; verify both public hostnames, private staging without a PR/local server, and target receipts before enabling automatic Mac dispatch, retaining legacy resources for separately reviewed retirement.
- [ ] 6.5 Record usage/latency baselines and a two-week reassessment procedure; verify the report includes staging builds and private-serving costs, current account billing/Access plan eligibility, and an equal comparison of GitHub Actions versus Cloudflare Builds without preselecting a future provider.
