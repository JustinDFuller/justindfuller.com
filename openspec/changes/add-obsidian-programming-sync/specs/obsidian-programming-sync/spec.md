## Purpose

Allow programming posts and their image assets to be read from the configured Obsidian Google Drive folder and overlaid onto the existing Git-backed blog in production, pull-request previews, and local development without requiring content commits or deployments.

## ADDED Requirements

### Requirement: The Obsidian source has a strict blog-only layout

The configured Drive folder SHALL be a blog-only source. Every file in its root SHALL be a programming Markdown file. The only permitted root directory SHALL be `image/`; it MAY contain nested directories, but every file below it SHALL be an image asset with a `.jpg`, `.png`, or `.svg` extension. The system SHALL report every file or directory that violates this layout as an observable source issue and SHALL continue processing files that satisfy the layout.

#### Scenario: A supported root Markdown file is discovered

- **WHEN** the configured source root contains a Markdown file with valid publication metadata for the programming section
- **THEN** the system SHALL consider the file eligible for synchronization

#### Scenario: A supported nested image is discovered

- **WHEN** the configured source contains a `.jpg`, `.png`, or `.svg` file at any depth below `image/`
- **THEN** the system SHALL consider the asset eligible for synchronization

#### Scenario: An unsupported file or directory is discovered

- **WHEN** the configured source contains a file other than a root Markdown file or an allowed image below `image/`, or contains a directory other than `image/` and its descendants
- **THEN** the system SHALL record an observable layout issue, SHALL not publish or serve that item, and SHALL continue synchronizing valid items without invalidating a post or image that does not depend on it

### Requirement: Every Markdown file has complete programming metadata

Because the configured Drive folder is blog-only, every root Markdown file SHALL be treated as an intended programming post. A file SHALL be eligible for publication only when its front matter contains exactly the supported metadata keys: required `environment`, `section`, `slug`, `title`, `date`, `draft`, `sync`, and `tags`, plus optional `subtitle` and `description`. The `environment` value SHALL be `prd`, `pr`, or `local`. The `section` value SHALL be `programming`. The `sync` value SHALL be either `add` or `overwrite`. Unknown metadata keys SHALL be validation errors rather than silently ignored. The `tags` value SHALL be a non-empty list of non-empty strings. When `description` is absent, the system SHALL derive an excerpt using the same observable excerpt behavior as the existing programming content.

#### Scenario: A complete publishing file is valid

- **WHEN** a root Markdown file contains only supported front matter keys, targets an eligible environment, identifies the programming section, contains a safe slug, has a non-empty title, has a valid date, sets `draft` to a Boolean, sets `sync` to `add` or `overwrite`, and contains at least one tag
- **THEN** the system SHALL validate and render the file as a candidate programming entry

#### Scenario: A required field is missing or malformed

- **WHEN** a root Markdown file has missing, malformed, unknown, or unsupported front matter
- **THEN** the system SHALL report a file-specific validation issue, SHALL omit only that Markdown post revision from the external overlay, and SHALL continue synchronizing all other valid files

#### Scenario: A Markdown file omits tags

- **WHEN** a root Markdown file has otherwise valid metadata but omits `tags` or supplies an empty or malformed tag list
- **THEN** the system SHALL report a file-specific validation issue, SHALL omit only that Markdown post revision from the external overlay, and SHALL continue synchronizing all other valid files

### Requirement: Environment targeting works in production, previews, and local development

The synchronization capability SHALL be available in the production deployment, pull-request preview deployments, and local development. Each runtime SHALL select its active environment explicitly. The `environment` metadata SHALL be one of `prd`, `pr`, or `local`, and SHALL represent the lowest environment in which the file is eligible. Eligibility SHALL follow this exact promotion matrix: `prd` files are eligible in production, pull-request previews, and local development; `pr` files are eligible in pull-request previews and local development; `local` files are eligible only in local development.

If source authentication or configuration is unavailable in any environment, the system SHALL continue serving Git-backed content and SHALL report the source failure.

#### Scenario: A production-targeted file is loaded by all supported runtimes

- **WHEN** a valid file targets `prd` and the production, preview, or local runtime has read access to the configured folder
- **THEN** the file SHALL be eligible for the programming route in that runtime

#### Scenario: A preview-targeted file is loaded by preview and local runtimes

- **WHEN** a valid file targets `pr`
- **THEN** the file SHALL be eligible in pull-request previews and local development and SHALL be ineligible in production

#### Scenario: A local-targeted file is loaded only by local development

- **WHEN** a valid file targets `local`
- **THEN** the file SHALL be eligible in local development and SHALL be ineligible in production and pull-request previews

#### Scenario: Drive authentication fails in a preview or local runtime

- **WHEN** the runtime cannot authenticate to or read the configured Drive folder
- **THEN** the runtime SHALL serve the normal Git-backed content, SHALL expose the source failure through observability, and SHALL remain usable

### Requirement: External entries merge additively with Git-backed programming content

The system SHALL retain all existing Git-backed programming entries and SHALL merge valid Obsidian entries into the programming collection at runtime. It MUST NOT require migration, deletion, or replacement of existing Markdown files.

The route identity SHALL be the pair `programming` and `slug`. An `add` entry SHALL be rejected when that route already exists locally or is claimed by another valid external entry. An `overwrite` entry SHALL be accepted only when exactly one local programming entry has the same route identity.

#### Scenario: A valid additive entry is loaded

- **WHEN** a valid `add` entry has a route identity that does not exist locally or externally
- **THEN** the system SHALL add it to the programming list and serve it at `/programming/<slug>`

#### Scenario: A valid overwrite entry is loaded

- **WHEN** a valid `overwrite` entry matches exactly one existing local programming route
- **THEN** the system SHALL serve the Obsidian content at that route while preserving the local source as the fallback base

#### Scenario: An additive entry collides with a local route

- **WHEN** an `add` entry targets an existing local programming route
- **THEN** the system SHALL reject that entry, report a collision issue, and leave the local route unchanged

#### Scenario: An overwrite target is missing or ambiguous

- **WHEN** an `overwrite` entry has no matching local route or matches more than one route
- **THEN** the system SHALL reject that entry, report the issue, and leave all other entries unaffected

### Requirement: Draft entries are never publicly published

An entry with `draft: true` SHALL be excluded from programming lists, direct public routes, and the sitemap in every runtime environment. A draft overwrite SHALL mask its matching local route while the valid draft file is active; it SHALL NOT expose the local post as a public fallback.

#### Scenario: A draft additive entry is synchronized

- **WHEN** a valid additive entry has `draft: true`
- **THEN** the system SHALL retain its diagnostics and validation state but SHALL not list or serve it publicly

#### Scenario: A draft overwrite targets a published local post

- **WHEN** a valid draft overwrite targets an existing local programming post
- **THEN** the system SHALL return not found for the public route and SHALL omit the route from lists and the sitemap

### Requirement: Markdown image assets are synchronized and served with the post

The system SHALL support image assets referenced by synchronized programming Markdown files. Supported image assets SHALL be limited exactly to `.jpg`, `.png`, and `.svg` files located at any depth below the top-level `image/` directory. Image references SHALL resolve only to files within that `image/` tree.

The system SHALL support standard relative Markdown image references and Obsidian image embeds that identify an image asset by name or relative path below `image/`. It SHALL rewrite valid external references to stable public asset URLs without exposing Drive credentials or requiring the browser to access Drive directly. Images located at the Drive root or anywhere outside `image/` SHALL be invalid.

An image asset SHALL be eligible for serving only when it is referenced by a valid published programming entry or is otherwise explicitly within the supported synchronized asset set.

#### Scenario: A programming post references a valid nested image

- **WHEN** a valid published programming entry references an allowed `.jpg`, `.png`, or `.svg` asset below `image/`, including a nested subdirectory
- **THEN** the system SHALL render the post with a public asset URL and SHALL serve the image without requiring client-side Drive authentication

#### Scenario: A post references a missing or invalid image

- **WHEN** a programming entry references an unavailable, unsupported, or unreadable image asset
- **THEN** the system SHALL report an issue for that image reference, SHALL omit only that image from the rendered post, and SHALL continue publishing the post body and all other valid image references

#### Scenario: A Markdown file references an image outside the source folder

- **WHEN** an image reference resolves outside the configured `image/` tree, including an image at the Drive root
- **THEN** the system SHALL report an issue for that image reference, SHALL not fetch or publish the external asset, and SHALL continue publishing the rest of the post when its other validations pass

#### Scenario: A Markdown file references an unsupported image format

- **WHEN** an image reference resolves to an image whose extension is not `.jpg`, `.png`, or `.svg`
- **THEN** the system SHALL report an image validation issue, SHALL omit only that image reference, and SHALL not prevent the rest of the post or synchronization pass from publishing

### Requirement: Synchronization failures are isolated by content item

The synchronization process SHALL not be transactional across all files. A Markdown validation error SHALL affect only the corresponding programming post. An image layout, format, resolution, download, or rendering error SHALL affect only that image asset or image reference. Neither class of item-level error SHALL abort synchronization, suppress valid changes, or make unrelated routes unavailable.

#### Scenario: A Markdown post is invalid while its image is valid

- **WHEN** one root Markdown file fails Markdown validation and an image asset is otherwise valid
- **THEN** the system SHALL omit only that programming post, SHALL leave the image available for other valid posts, and SHALL continue processing the source

#### Scenario: An image is invalid while its Markdown post is valid

- **WHEN** a root Markdown file passes Markdown validation but one referenced image fails image validation
- **THEN** the system SHALL publish the post without that image, SHALL report only the image issue, and SHALL continue publishing the post's text and other valid images

#### Scenario: Multiple items contain independent errors

- **WHEN** multiple Markdown files or image assets contain independent errors in one synchronization pass
- **THEN** the system SHALL report each issue independently and SHALL publish every item that passes its applicable validations

### Requirement: Markdown validation is a closed and explicit set

For each root Markdown file, the implementation SHALL perform exactly the following content validations: the file is valid UTF-8; front matter is present, delimited, and parseable; front matter keys, required fields, types, and values satisfy the supported metadata contract; the slug matches the supported programming route format; the Markdown body contains non-whitespace content and renders successfully; image reference syntax is recognized and each reference is evaluated against the image-asset rules; unsupported Obsidian syntax other than supported image embeds is absent; and rendered content does not contain executable HTML elements, inline event-handler attributes, `javascript:` URLs, or path-traversal references. Failure of an image-asset check SHALL omit only the affected image reference and SHALL not fail the Markdown post validation.

The implementation SHALL NOT add additional Markdown rejection rules based on writing style, heading structure, link destinations other than the explicitly prohibited URL scheme, arbitrary content heuristics, undocumented size thresholds, or metadata fields outside the supported contract. Publication-policy checks such as draft state, environment eligibility, route collisions, and source layout SHALL remain separate from Markdown content validation.

#### Scenario: A Markdown file passes the complete Markdown validation set

- **WHEN** a root Markdown file is valid UTF-8, has parseable supported front matter, has a valid body, uses recognized image reference syntax, contains only supported syntax, and contains no prohibited executable or traversal content
- **THEN** the system SHALL allow the file to proceed to publication-policy evaluation

#### Scenario: A Markdown file contains malformed or unsupported Markdown content

- **WHEN** a root Markdown file fails one or more Markdown validations in the explicit validation set, excluding a non-fatal image-asset check
- **THEN** the system SHALL record the corresponding file-specific issue, SHALL omit only that Markdown post revision from the external overlay, and SHALL continue processing all other files

#### Scenario: A valid file is changed while another file is invalid

- **WHEN** one file fails the explicit validation set during a synchronization pass and another file passes it and changes
- **THEN** the system SHALL apply the valid change and SHALL isolate the invalid file's failure

#### Scenario: A file has a condition outside the validation set

- **WHEN** a Markdown file passes the explicit validation set and fails no separate publication-policy check
- **THEN** the system SHALL not reject the file based on an undocumented additional Markdown rule

### Requirement: Invalid files cannot take down the blog

Synchronization SHALL be isolated at the individual-file level. An invalid new file SHALL be absent from the published overlay. An invalid revision of a previously valid external entry SHALL retain its last-known-good external revision when available; if no last-known-good external revision exists, an overwrite SHALL fall back to its local base and an additive entry SHALL remain absent.

For image-specific failures, the affected image asset or reference SHALL be omitted, but the referencing Markdown post SHALL remain eligible when its own validations and publication-policy checks pass. An invalid image SHALL never invalidate the post, other image references, or unrelated files.

A source-wide failure, including Drive authentication, folder access, listing, or transport failure, SHALL preserve the complete last-known-good external overlay when available and SHALL otherwise fall back to Git-backed content. No synchronization failure SHALL cause unrelated blog routes to return an application error.

#### Scenario: A new file is invalid

- **WHEN** an invalid file has never been published successfully
- **THEN** the system SHALL omit only that file and SHALL continue serving all local and valid external posts

#### Scenario: A published external file becomes invalid

- **WHEN** a previously valid external file is edited into an invalid revision
- **THEN** the system SHALL keep its last-known-good revision active, mark the current revision as invalid, and SHALL continue serving all other content

#### Scenario: The source becomes unavailable after a successful sync

- **WHEN** the configured Drive source cannot be read after a successful synchronization
- **THEN** the system SHALL retain the last-known-good external overlay, SHALL serve the local site normally, and SHALL report the source outage

### Requirement: Production synchronization failures degrade gracefully

In production, synchronization SHALL be best-effort and SHALL never be on the critical path for serving the existing blog. A failed initial synchronization SHALL leave all Git-backed routes and the local-only sitemap available. A failed later synchronization SHALL retain the last-known-good external state when available, mark the external state as stale, and continue serving all unaffected routes. Synchronization failures SHALL NOT turn ordinary page, image, or sitemap requests into application errors.

The system SHALL classify source-wide production synchronization failures as either recoverable or unrecoverable, and SHALL expose the distinction through diagnostics and structured events as `transient_source_failure` or `configuration_or_authorization_failure`. Recoverable failures SHALL include temporary Drive, Google Cloud, network, timeout, rate-limit, and service-availability failures. The system SHALL retain the last-known-good state when available, or use Git-backed content when no external state exists, mark synchronization degraded, and retry with bounded backoff without requiring a configuration change. Unrecoverable failures SHALL include missing or invalid credentials, missing or invalid source configuration, and denied or otherwise unusable folder access that requires operator action. The system SHALL retain the same content fallback, expose an actionable configuration or authorization issue, avoid tight retry loops, and resume synchronization after the underlying configuration or authorization is corrected.

#### Scenario: The first production synchronization fails temporarily

- **WHEN** the first production synchronization cannot complete because of a temporary Drive, Google Cloud, network, timeout, rate-limit, or service-availability failure
- **THEN** the system SHALL serve all Git-backed programming pages and images, SHALL serve a valid local-only sitemap, SHALL expose the failure through diagnostics and alerts, and SHALL return successful responses for unaffected requests

#### Scenario: The first production synchronization fails because configuration or authorization is unusable

- **WHEN** the first production synchronization cannot complete because credentials are missing or invalid, the source configuration is missing or invalid, or access to the configured folder is denied and requires operator action
- **THEN** the system SHALL serve all Git-backed programming pages and images, SHALL serve a valid local-only sitemap, SHALL expose an actionable configuration or authorization issue through diagnostics and alerts, SHALL avoid a tight retry loop, and SHALL return successful responses for unaffected requests

#### Scenario: A temporary production synchronization failure recovers

- **WHEN** a production synchronization previously failed for a recoverable source-wide reason and a later retry succeeds
- **THEN** the system SHALL replace the degraded or local-only external state with the newly synchronized valid state, SHALL emit recovery information, and SHALL clear the active recoverable failure after successful reconciliation

#### Scenario: An unrecoverable production synchronization failure is corrected

- **WHEN** an operator corrects credentials, source configuration, or folder authorization after an unrecoverable first or later production synchronization failure
- **THEN** the system SHALL resume synchronization, reconcile valid external files, retain file-level isolation for content errors, and SHALL emit recovery information for the corrected source-wide issue

#### Scenario: A later production synchronization fails

- **WHEN** production has a last-known-good external state and a later synchronization fails at the source level
- **THEN** the system SHALL continue serving that external state and all Git-backed content, SHALL mark the external state stale, SHALL expose the failure, and SHALL not replace valid content with an empty overlay

#### Scenario: A production page requests an unavailable external image

- **WHEN** an external image cannot be read while the associated Markdown entry remains otherwise valid
- **THEN** the system SHALL omit only that image from the rendered post, SHALL continue serving the post body and unrelated pages and images, and SHALL not fail the entire programming route collection or sitemap

### Requirement: Local Drive authentication uses macOS Keychain-backed user OAuth

When the runtime environment is `local`, the synchronization capability SHALL obtain Drive credentials from a macOS Keychain generic password item rather than from a service-account key, `GOOGLE_APPLICATION_CREDENTIALS`, or the well-known local ADC file. The item SHALL contain an `authorized_user` OAuth payload with a Drive-read-scoped refresh token, client ID, and optional client secret. The default Keychain service SHALL be `justindfuller.com/obsidian-google-drive`, and the default account SHALL be the current macOS user; both values MAY be overridden by local-only configuration. The implementation SHALL reject service-account credential payloads and SHALL never log the Keychain payload, refresh token, access token, or client secret.

Preview and production runtimes SHALL continue using their hosted ADC identity and SHALL not attempt to read the local macOS Keychain.

#### Scenario: Local synchronization uses the Keychain credential

- **WHEN** local synchronization initializes with a valid authorized-user payload in the configured Keychain item
- **THEN** the Drive client SHALL use that user OAuth refresh token for read-only Drive access without reading a local credential file

#### Scenario: The local Keychain item is missing or unusable

- **WHEN** local synchronization cannot read the configured Keychain item, the item is malformed, or the payload is not an authorized-user credential
- **THEN** the system SHALL report a configuration or authorization issue, SHALL preserve the existing fallback behavior, and SHALL not attempt to use a service-account key or local ADC file

#### Scenario: A hosted runtime starts synchronization

- **WHEN** preview or production synchronization initializes
- **THEN** the system SHALL use hosted ADC credentials and SHALL not invoke the local Keychain reader

### Requirement: External deletions are non-destructive to Git content

The system SHALL treat Drive deletion or removal from the configured source as removal of external ownership only. Deleting an additive entry SHALL remove that external post. Deleting an overwrite entry SHALL restore the matching local programming entry. The system MUST NOT delete or modify Git-backed files.

#### Scenario: An additive file is deleted from Drive

- **WHEN** a previously published additive file is deleted or removed from the configured source
- **THEN** the system SHALL remove that external route after a confirmed source reconciliation and SHALL leave local content unchanged

#### Scenario: An overwrite file is deleted from Drive

- **WHEN** a previously published overwrite file is deleted or removed from the configured source
- **THEN** the system SHALL restore the matching local route and SHALL leave the repository unchanged

### Requirement: Source provenance and synchronization issues are observable

The system SHALL expose the effective source of every resolved programming route as `local` or `obsidian`, and SHALL distinguish an Obsidian overwrite from a purely additive Obsidian entry. It SHALL provide protected diagnostics containing synchronization timestamps, source identity, file identity, revision state, active issues, and the affected route when known.

The system SHALL emit structured synchronization events for successful files, ignored files, invalid files, image-specific failures, source-wide failures, additions, overwrites, deletions, and recovery from an issue. Source-wide events SHALL distinguish `transient_source_failure` from `configuration_or_authorization_failure`. It MUST NOT include post bodies, access tokens, or other credentials in logs or diagnostics.

#### Scenario: An administrator inspects synchronized content

- **WHEN** an authenticated administrator requests synchronization diagnostics
- **THEN** the response SHALL identify which programming routes are local, additive Obsidian, or Obsidian-overridden local content

#### Scenario: A file is invalid

- **WHEN** a synchronized file fails validation
- **THEN** diagnostics and structured logs SHALL identify the file, revision, issue category, actionable message, and whether a last-known-good or local fallback is active

#### Scenario: An issue is corrected

- **WHEN** a previously invalid file becomes valid in a later revision
- **THEN** the system SHALL publish the valid revision according to its metadata and SHALL emit a recovery event

### Requirement: Administrators are notified of actionable synchronization issues

The system SHALL provide an alertable signal for active invalid files and source-wide synchronization failures. Notifications SHALL be deduplicated while an unchanged issue remains active and SHALL resolve or emit recovery information after the issue is corrected.

#### Scenario: A new invalid file issue appears

- **WHEN** a synchronization pass detects a new invalid file or a new invalid revision
- **THEN** the system SHALL make the issue eligible for administrator notification without interrupting blog serving

#### Scenario: An unchanged issue is retried

- **WHEN** the same invalid revision is observed during later synchronization passes
- **THEN** the system SHALL retain the issue state without sending an unbounded duplicate notification for every request

#### Scenario: The issue is corrected

- **WHEN** the affected file becomes valid
- **THEN** the system SHALL mark the issue resolved and SHALL make the recovery observable

### Requirement: The sitemap includes synchronized programming routes

The sitemap SHALL contain all existing local URLs plus every valid, published, non-draft synchronized programming route. It SHALL exclude invalid, draft, environment-ineligible, and unsupported files. It SHALL preserve existing local sitemap entries and SHALL not depend on homepage feature-post selection.

When the external source is unavailable, the sitemap SHALL use the last-known-good external routes when available and SHALL otherwise remain valid with local entries.

#### Scenario: A valid external programming post is published

- **WHEN** a valid non-draft Obsidian programming entry is active
- **THEN** its canonical `/programming/<slug>` URL SHALL appear in the sitemap

#### Scenario: An external entry is draft or invalid

- **WHEN** an external entry is draft, invalid, or environment-ineligible
- **THEN** its URL SHALL NOT appear in the sitemap

#### Scenario: A synchronized post is removed

- **WHEN** an additive external post is removed or an overwrite is deleted and the local base is restored
- **THEN** the sitemap SHALL reflect the resulting effective route set without removing unrelated local URLs

### Requirement: Synchronized posts do not modify dynamic homepage feature posts

The synchronization capability SHALL NOT add, remove, reorder, or overwrite homepage feature posts. A synchronized programming entry SHALL be discoverable through its programming list, canonical route, diagnostics, and sitemap only unless a separate future capability explicitly changes homepage behavior.

#### Scenario: A synchronized post is marked as featured

- **WHEN** a synchronized file contains an unsupported feature-post field or otherwise requests homepage prominence
- **THEN** the system SHALL not modify the homepage feature-post collection and SHALL report the unsupported behavior if the metadata is invalid

### Requirement: The source is read-only and narrowly scoped

The synchronization capability SHALL use read-only access to the configured Drive source. It MUST NOT write, rename, delete, or change permissions on Drive files, and it MUST NOT modify Git-backed content as a consequence of synchronization.

#### Scenario: Synchronization completes

- **WHEN** the system lists, downloads, validates, or serves synchronized content
- **THEN** it SHALL perform no Drive or repository mutation

#### Scenario: A route collision or invalid file is detected

- **WHEN** validation rejects an external file
- **THEN** the system SHALL record the issue and alter only the runtime overlay state, never the source file or Git content
