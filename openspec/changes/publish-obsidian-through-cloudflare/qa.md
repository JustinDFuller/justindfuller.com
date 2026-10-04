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

Cloudflare Access currently returns `access.api.error.not_enabled`. Activation and the owner's explicitly chosen email remain pending. Hosted private deployment must stay gated until Access application/policy checks and sentinel denial proofs succeed. Remaining implementation includes actual Actions reconciliation, hosted private archive handoff, protected report writes, live transaction adapters, credential provisioning, and hosted fault/privacy verification.

## Storage and Access command round

The production preparation of the same unchanged post used a private copy with only its environment value changed. Go verified promotion authorization for all 11 effective images. Authorization rejects nonprod, draft, unused, and mismatched effective references even when the prepared digest is recomputed. Node promotion tests exercise separate private-source/public-media destinations, bounded original reads, byte/signature/hash verification, immutable public cache metadata, unchanged metadata-only checks, missing/corrupt-reference isolation, and credential failures that block deployment.

The private R2 state adapter verifies explicit body hashes and metadata across fresh transaction instances and rejects paths outside state/report/archive namespaces. Archive tests prove immutable checksummed handoff without public Actions artifacts. Access tests require exact owner and expiring service credentials, whole Worker destinations, complete bounded pagination, and denial before and after authenticated sentinel warmup. Missing Access, unsafe policies, overlapping applications, identity spoofing, and invalid service tokens fail closed. These tests use controlled transports and do not establish live account protection.

This round's combined Node suite passed 42 tests; TypeScript checking, changed-script ESLint, OpenSpec validation, and planning Markdown validation passed. New Go promotion authorization tests and race checks passed. The hosted-equivalent golangci-lint v2.9.0 reported zero issues. Protected verifier errors stay in ignored private files, private build output is captured, and staging deployment records use only the staging hostname. Hosted checks for this round remain pending until its commit is pushed.

The actual post was also built through staging and production from separate private preparations. Both builds and deployment dry-runs passed; staging included the private source binding, production reported no runtime bindings and no private-image manifest entries. These operations uploaded no hosted private artifact. The original vault file matched its saved byte-for-byte baseline afterward, and the production-copy body hash matched `1ffaf67cfa6a531ef13c37f6a5ab44d67f4061b079aff4d72a0f7a2cf027177d`.

## Commit boundaries

Proposal commit: `331f4ff`, PR #402. Foundation implementation commit: `8d7eb4d`, PR #403, with hosted Go, lint, site, and preview checks green. The storage/Access command round is being committed separately on `codex/publish-obsidian-cloudflare-implementation`; subsequent implementation and QA-only commits will be recorded as they are published.
