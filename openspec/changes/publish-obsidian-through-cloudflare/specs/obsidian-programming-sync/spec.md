# Obsidian Programming Sync

## Purpose

Publish Obsidian programming posts and images through Cloudflare storage and the existing static site build, without content commits. Provide private persistent staging and two post targets while preserving Git-backed content, unpublished-content privacy, isolated validation failures, and durable last-known-good state, with observable GitHub Actions usage.

## ADDED Requirements

### Requirement: The publishing source is a private blog-only snapshot

The system SHALL accept root Markdown files from the configured vault `Blog/` folder and supported images at any depth below its `image/` folder. Unsupported source items SHALL produce protected diagnostics and SHALL not prevent unrelated valid items from being processed. Control manifests SHALL not become posts. Raw Markdown, draft metadata, manifests, and publication state SHALL remain private. Each activated source revision SHALL identify a complete, immutable collection; incomplete uploads SHALL not appear as source deletions.

#### Scenario: An upload stops before activation

- **WHEN** only part of a new revision has been uploaded
- **THEN** builds SHALL continue reading the previous complete source revision and SHALL not infer deletion from the partial upload

#### Scenario: An unsupported file is present

- **WHEN** an unsupported file is found alongside valid blog content
- **THEN** the system SHALL report that item privately and SHALL continue processing valid content

### Requirement: Programming metadata defines nonprod and production targets

Each Markdown post SHALL require exactly `environment`, `section`, `slug`, `title`, `date`, `draft`, `sync`, and `tags`, with optional `subtitle` and `description`. Unknown keys SHALL be invalid. The section SHALL be `programming`; the slug SHALL match `^[a-z0-9]+(?:-[a-z0-9]+)*$`; tags SHALL be a nonempty list of nonempty strings; sync SHALL be `add` or `overwrite`. Types, dates, and text values SHALL retain PR #390's validation contract except for the environment enum. Missing descriptions SHALL use the existing programming excerpt behavior. Environment SHALL be exactly `nonprod` or `production`. Production builds SHALL include only production-target posts; staging, PR previews, and local builds SHALL include both targets, subject to draft and validation rules. Migration SHALL explicitly map legacy `prd` to `production` and legacy `pr`/`local` to `nonprod`; the new parser SHALL reject legacy aliases.

#### Scenario: A nonprod post is uploaded

- **WHEN** a valid nondraft post targets `nonprod`
- **THEN** it SHALL be eligible in local, PR, and persistent staging builds and SHALL remain absent from production routes, lists, sitemap, feeds, and other public output

#### Scenario: A post is promoted to production

- **WHEN** a valid nondraft post changes its target from nonprod to production
- **THEN** the next successful reconciliation SHALL make it eligible in production and SHALL retain its eligibility in private previews

#### Scenario: A post is demoted from production

- **WHEN** a previously accepted file has a valid target change to nonprod
- **THEN** production SHALL remove its external ownership on the next successful reconciliation, restoring a matching Git overwrite fallback or removing an additive route, and SHALL not retain the old external production revision through last-known-good fallback

#### Scenario: Metadata is invalid

- **WHEN** one file omits a required field or uses an unknown field or invalid value
- **THEN** only that file revision SHALL fail validation and unrelated valid files SHALL remain publishable

### Requirement: External entries preserve Git content and route ownership

The system SHALL merge eligible Obsidian entries into the programming list, direct routes, and sitemap without modifying Git files. Route identity SHALL be `programming` plus slug. An `add` entry SHALL require an unclaimed local and external route. An `overwrite` entry SHALL match exactly one Git entry. Conflicting external claims SHALL be reported and SHALL not depend on discovery order. Removing a file from a complete source revision SHALL remove its external ownership: additive posts disappear and overwritten Git posts return. Homepage feature posts SHALL remain unaffected.

#### Scenario: An overwrite is removed

- **WHEN** a complete activated source revision omits a previously accepted overwrite file
- **THEN** the next successful publication SHALL restore the Git-backed route, list entry, and sitemap URL

#### Scenario: Two files claim one route

- **WHEN** multiple eligible external files claim the same route
- **THEN** the system SHALL report the conflict and SHALL retain the previously accepted route resolution, or the Git-backed resolution if none exists, while publishing unrelated changes

### Requirement: Drafts remain excluded from every rendered environment

Draft additive posts SHALL be absent from pages, lists, and sitemaps in every environment, including protected previews. A valid eligible draft overwrite SHALL mask the matching Git route and SHALL not expose its Git fallback. Private draft details SHALL not enter public logs, artifacts, or preview comments. A post intended for private review SHALL use the nonprod target with draft false. Never-published draft image revisions SHALL remain private and SHALL not be promoted solely because a draft references them.

#### Scenario: A published route becomes a draft overwrite

- **WHEN** a valid draft overwrite is included in a successfully published revision
- **THEN** its direct route SHALL return not found and its list and sitemap entries SHALL be absent

### Requirement: Markdown validation is explicit and failures are isolated

Markdown validation SHALL be limited to valid UTF-8, present and parseable supported front matter, valid metadata and slug, a nonempty body that renders successfully, supported image-reference syntax, absence of unsupported Obsidian syntax other than supported image embeds, and absence of executable HTML elements, inline event handlers, `javascript:` URLs, and path traversal. Image failures SHALL omit only the affected image reference. The system SHALL not reject posts using undocumented writing-style, heading, arbitrary link, or content-size heuristics. Publication policy and source protocol checks SHALL remain separate from Markdown validation.

#### Scenario: A previously valid post is edited incorrectly

- **WHEN** one accepted file's new revision fails validation while another valid file changes
- **THEN** the first SHALL retain its last-known-good content and the second SHALL publish its valid change

### Requirement: Image delivery preserves publication privacy and production caching

The publisher SHALL accept lowercase `.jpg`, `.png`, and safe `.svg` images below `image/`, validate file signatures and static SVG content, and enforce the existing 20 MiB per-image limit. Standard relative Markdown images and supported Obsidian image embeds SHALL resolve within that tree. Images SHALL use immutable SHA-256 object keys and verified size, content type, and hash metadata before becoming available to publication. Source image uploads SHALL remain private. Only image objects referenced by the effective accepted nondraft production collection SHALL be eligible for public promotion; invalid, nonprod, draft, and unused source references SHALL not independently authorize promotion.

Production browsers SHALL fetch promoted image bodies directly from `https://media.justindfuller.com/v1/<sha256>.<extension>` with long-lived immutable caching independently of HTML publication. Staging and PR browsers SHALL use same-origin authenticated private image URLs; local preview SHALL use a loopback private image gateway. Private image delivery SHALL not expose raw Markdown, manifests, or arbitrary source objects. Go builds and Go serving SHALL read image metadata only and SHALL never download or proxy image bodies. Changing a previously published post to nonprod SHALL not be described as revoking copies already public or downloaded; identical bytes shared with an already published image are already public.

#### Scenario: An image changes

- **WHEN** an image receives different validated bytes
- **THEN** it SHALL receive a new immutable URL and existing cached image URLs SHALL remain valid

#### Scenario: A nonprod post references a unique image

- **WHEN** an image revision is referenced only by nonprod posts or drafts and has never been published
- **THEN** it SHALL remain absent from public media storage and public artifacts, and anonymous requests to its private preview URL SHALL reveal no image bytes

#### Scenario: An image becomes eligible for publication

- **WHEN** a valid accepted production post references a verified private image
- **THEN** the production workflow SHALL verify its public destination before deploying a page that refers to that destination

#### Scenario: An image record is missing or inconsistent

- **WHEN** a reference lacks a usable manifest entry or verified destination metadata
- **THEN** the build SHALL omit only that reference, report its issue privately, and retain the post body and other valid references

### Requirement: GitHub Actions publishes batched revisions without content commits

Automatic publishing SHALL operate on the Mac while Obsidian is running, with a manual publish command and periodic reconciliation. Edits SHALL be batched; repeated scans of unchanged content SHALL not dispatch new builds. A completed revision SHALL trigger the existing GitHub Actions workflow on `main`, without committing content. Failed dispatches SHALL be retried with bounded backoff and visible status. A dispatch SHALL reconcile staging and production independently using the latest complete source revision within each target's concurrency boundary rather than force publication of an older requested revision. Successful dispatch SHALL be distinguishable from verified publication for each target. Production code and content deployments SHALL share one concurrency boundary; staging SHALL have its own boundary. Content-only runs SHALL skip frontend dependency installation, full site rendering, and deployment for each target whose active code and effective accepted output are unchanged.

#### Scenario: Several edits occur during one batch

- **WHEN** several vault changes settle together
- **THEN** the publisher SHALL activate one complete revision and request one publishing run

#### Scenario: An older dispatch executes after a newer upload

- **WHEN** a queued publishing run starts after a newer complete revision has been activated
- **THEN** the run SHALL reconcile the latest revision and SHALL not restore stale content merely because its dispatch mentioned an older revision

#### Scenario: Upload succeeds but dispatch fails

- **WHEN** the source revision is activated and GitHub cannot accept the dispatch
- **THEN** the publisher SHALL retain a pending request across restarts and SHALL retry without uploading the same unchanged objects again

#### Scenario: Only nonprod output changes

- **WHEN** an activated revision changes staging output but leaves production output unchanged
- **THEN** the workflow SHALL rebuild and verify staging while skipping production rendering and deployment and SHALL record both target outcomes

### Requirement: Durable fallback survives runners and publication failures

Accepted source content, route ownership, draft masks, and diagnostics SHALL persist privately between runs, separately for production, staging, each PR preview, and local development. Reused content SHALL be revalidated against current code, target eligibility, and Git routes. Invalid new entries SHALL remain absent; invalid revisions SHALL retain the matching file's eligible last-known-good state. A valid target change SHALL remove old eligibility before fallback is considered. Source-wide authentication, manifest, listing, integrity, and transport failures SHALL retain the target's complete accepted overlay when available. A content-only run lacking usable source and accepted state SHALL leave that target's current site deployed. A first installation with no accepted overlay SHALL support an explicit Git-only bootstrap; later runs SHALL not silently erase accepted content when state is unavailable. Failure of one target SHALL not promote, corrupt, or roll back another target's accepted state.

#### Scenario: A fresh runner encounters a source outage

- **WHEN** the source cannot be read but accepted private state exists
- **THEN** the system SHALL preserve that overlay, mark the source degraded, and SHALL not treat unreadable files as confirmed deletions

#### Scenario: Accepted state is inaccessible

- **WHEN** an installed publishing system cannot load its accepted state safely
- **THEN** it SHALL stop before deployment and SHALL retain the currently served site instead of silently publishing a Git-only replacement

### Requirement: Publication is verified and recoverable

The system SHALL build from a pinned code commit and complete source revision, generate the effective pages and sitemap together, and deploy the same artifact that passed validation. Publication records SHALL identify code commit, source revision, accepted-content digest, artifact checksum, workflow run, and deployment identity. Private fallback state SHALL advance only for a verified publication; unchanged effective content SHALL permit a verified no-deployment reconciliation. A build failure SHALL not deploy. A live verification failure after deployment SHALL attempt to restore and verify the prior deployment. Ambiguous deployment or state promotion SHALL remain explicitly unverified until reconciled with the actual serving identity.

#### Scenario: Verification fails after upload

- **WHEN** a candidate deployment fails the existing strict live checks
- **THEN** the system SHALL attempt rollback, record whether rollback was verified, and SHALL not mark the candidate accepted

### Requirement: Persistent staging and previews require owner authentication

Production and persistent staging SHALL update automatically from main and applicable source revisions. Staging SHALL remain available at `staging.justindfuller.com` without a running local server or open PR. PR previews SHALL include the applicable source snapshot during existing build events and an explicit manual refresh of an open same-repository PR. Vault edits SHALL not automatically rebuild every preview. Preview builds SHALL remain noindex and SHALL never alter production state.

Cloudflare Access SHALL protect the entire staging Worker and all production-Worker PR preview destinations, including every enabled custom domain, workers.dev URL, alias, and immutable preview URL. Human access SHALL be restricted to the explicitly configured owner's identity; CI verification SHALL use a separate Service Auth policy and protected service token. Anonymous, disallowed, and invalid-token requests SHALL reveal no private HTML, asset, sitemap/feed data, or image bytes. Protection SHALL be established and verified with nonsensitive content before any nonprod deployment; absent or unverifiable required protection SHALL block private deployment. Authenticated staging/PR responses SHALL use private no-store caching, and denied requests after authorized requests SHALL remain denied. Production SHALL remain public and preserve its existing caching behavior.

Fork and Dependabot validation SHALL remain credential-free and SHALL use Git content and fixtures. Local development SHALL support explicit source preparation and Git-only operation, with preview and private-image listeners bound to loopback.

#### Scenario: The owner previews without a PR or local server

- **WHEN** a valid nonprod post has been successfully reconciled and no PR or local server is running
- **THEN** the owner SHALL be able to authenticate to persistent staging and preview the post and its images

#### Scenario: A private preview URL is shared

- **WHEN** an unauthenticated or disallowed client requests staging, a PR alias, an immutable preview URL, or a private image path
- **THEN** Access SHALL withhold private response bodies even after authorized requests to the same resources

#### Scenario: Access protection is missing

- **WHEN** a build cannot verify the required Access protection for a private destination
- **THEN** it SHALL not deploy private content to that destination and SHALL report an actionable private deployment failure

#### Scenario: A fork PR is built

- **WHEN** a preview or validation run belongs to a fork or Dependabot
- **THEN** it SHALL receive no R2 source, state, or deployment credentials and SHALL validate using Git-backed content and fixtures

### Requirement: Protected diagnostics and resource usage are observable

The system SHALL retain private diagnostics identifying synchronization status, file revisions, issues, route provenance, fallback state, and recovery separately for each target. Operators SHALL retrieve these reports through authenticated read-only tooling. Public Actions logs, summaries, artifacts, and comments SHALL contain sanitized counts, opaque revision identifiers, deployment identities, root deployment URLs, and safe failure categories only. They SHALL not include private filenames, nonprod/draft titles or slugs, unpublished post bodies, raw Markdown, secrets, or complete diagnostics. Rendered staging/PR archives and their detailed verification manifests SHALL remain privately stored and SHALL be transferred between jobs through authenticated checksummed storage; Cloudflare Access SHALL not be treated as protecting GitHub artifact downloads. Public artifacts SHALL contain only approved production assets and sanitized receipts. Actionable issues SHALL have durable deduplicated notification state; the Mac publisher SHALL display target-specific new issues and recovery after reading the protected report. Reports SHALL omit post bodies and credentials.

The system SHALL record publishing batch counts, per-target runner durations, build and deployment frequency, skips, retries, upload-to-verification latency, and relevant Cloudflare storage/operation/Worker usage, including additional staging work. GitHub Actions SHALL remain the selected service until a later reassessment. Included allowances SHALL not be described as spending caps, and unchanged scans SHALL not trigger scheduled rebuilds or per-preview fan-out.

#### Scenario: A private preview archive is passed to a deployment job

- **WHEN** staging or a PR build produces rendered nonprod HTML and verification data
- **THEN** the tested archive SHALL be retrieved privately and verified by checksum, and public workflow artifacts/logs SHALL contain no unpublished content or private paths

#### Scenario: The same invalid revision is retried

- **WHEN** later runs observe an unchanged issue
- **THEN** the protected report SHALL retain its fingerprint and the publisher SHALL not emit repeated notices for every scan

#### Scenario: An operator assesses build cost

- **WHEN** publishing has operated for a representative period
- **THEN** recorded run frequency, durations, latency, and provider usage SHALL support comparing GitHub Actions with Cloudflare Builds without changing content semantics

### Requirement: Bounded publication archive storage

The system SHALL store one canonical compressed tested archive per build, shared by authenticated job handoff and retained rollback. Identical payloads within a build SHALL be stored once, and restoration SHALL preserve exact file bytes with bounded decompression and legacy archive compatibility. After a successful publish in the target concurrency boundary, maintenance SHALL preserve all current accepted-state and active-journal archive references regardless of age, retain at most three additional unreferenced archives per target for at most 14 days, and delete only canonical archive objects for that target. Missing, malformed, or changing state SHALL block cleanup. Source, media, reports, accepted-state backups, and other state SHALL remain untouched. Cleanup failure SHALL be reported separately and SHALL not invalidate publication.

#### Scenario: Many successive publishes do not retain every historical build

- **WHEN** a target publishes repeatedly and maintenance runs after verified acceptance
- **THEN** current and journal-referenced archives remain available and at most three additional recent unreferenced archives remain

#### Scenario: Old current deployment remains recoverable

- **WHEN** an accepted deployment or its journal rollback archive is older than 14 days
- **THEN** maintenance SHALL preserve its archive and delete only unreferenced archives eligible under the policy

#### Scenario: State changes during cleanup

- **WHEN** accepted state or the active journal changes between planning and deletion
- **THEN** cleanup SHALL stop before further deletion and SHALL not mark the verified publication failed
