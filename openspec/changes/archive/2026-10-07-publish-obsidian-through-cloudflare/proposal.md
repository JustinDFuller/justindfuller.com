# Publish Obsidian Through Cloudflare

## Why

The site now renders Go templates at build time and serves them through Cloudflare Workers Static Assets. PR #390's running Go server, Google source sync, and S3/CloudFront delivery no longer fit that deployment; Obsidian publishing should use Cloudflare storage and the existing GitHub Actions pipeline.

## What Changes

- Publish the Mac Obsidian vault's `Blog/` Markdown and validated images to private R2 source storage. Promote only images referenced by accepted production posts to the public R2 bucket at `media.justindfuller.com`; unpublished images remain private.
- Expand the existing image publisher into a content publisher that uploads complete immutable source revisions and automatically dispatches the existing deployment workflow after batching edits. Content stays outside Git.
- Reuse PR #390's programming metadata, validation, additive/overwrite rules, draft masking, image-reference parsing, and last-known-good behavior inside the current Go exporter rather than introducing a running Go server.
- Persist accepted content and protected diagnostics in a separate private R2 state bucket so ephemeral Actions runners retain valid content across builds and failures.
- Keep GitHub Actions as the initial build and deployment service. Share production concurrency with code deployments, skip duplicate content revisions, retain deployment verification, and measure build usage for later reassessment. A couple minutes is an acceptable normal publishing delay, not a guaranteed service-level target.
- **BREAKING:** Replace the old `prd`, `pr`, and `local` post targets with `environment: nonprod | production`. Production posts are eligible everywhere; nonprod posts are eligible only in local, PR, and staging previews. Preserve draft exclusion and provide an explicit metadata migration.
- Add persistent staging at `staging.justindfuller.com`, updated automatically from main and the latest complete source revision, without requiring a local server or PR. Protect the whole staging Worker and every PR preview URL with Cloudflare Access restricted to the owner's identity; CI uses separate service authentication.
- Refresh PR previews on their existing build events or an explicit refresh; do not rebuild every open PR after each vault edit. Local development reads snapshots on demand and binds to loopback. Reconcile staging and production independently so nonprod-only edits do not rebuild production.
- Keep rendered staging/PR artifacts, diagnostics, and private image delivery behind authenticated boundaries; exclude unpublished content from public Actions artifacts and logs.
- Supersede PR #390's Google/CloudFront rollout plan. Reuse selected implementation and regression tests from that PR against current main instead of merging its obsolete server and deployment wiring wholesale.

## Capabilities

### New Capabilities

- `obsidian-programming-sync`: Automatic, revision-based Obsidian publishing through R2 and GitHub Actions, with two post targets, persistent private staging, protected PR previews and images, isolated validation failures, durable fallback, and observable publication status.

### Modified Capabilities

None. The current Cloudflare checkout has no main OpenSpec capabilities; the unmerged capability on PR #390 is the behavioral baseline for this replacement proposal.

## Impact

- Extend the Mac Obsidian publisher and Go content/export interfaces; integrate with the current Cloudflare workflow, artifact verifier, and local preview commands.
- Add three R2 buckets with separate private-source, public-image, and private-state/artifact access boundaries; a staging Worker/custom domain; targeted Cloudflare Access applications; R2 credentials; CI service authentication; and a dedicated GitHub workflow-dispatch credential. Provision staging authority separately and retain the production credential's existing scope.
- Add portable source preparation and publication commands so a later build-service change can preserve content semantics. Cloudflare Builds and live Worker rendering remain alternatives to reassess, not selected implementations.
- Preserve historical PR #390 QA evidence as historical. New acceptance must cover R2 upload, static rendering, hosted workflows, private staging/preview URLs and images, artifact privacy, target promotion/demotion, production HTTPS/caching, rollback, and actual resource usage. Retirement of existing Google/AWS resources is separate from this publishing change.
