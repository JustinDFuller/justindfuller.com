# Spec Delta

## MODIFIED Requirements

### Requirement: Programming metadata defines nonprod and production targets

Each Markdown post SHALL require exactly `environment`, `section`, `slug`, `title`, `date`, `draft`, `sync`, and `tags`, with optional `subtitle`, `description`, and `image`. Unknown keys SHALL be invalid. The section SHALL be `programming`; the slug SHALL match `^[a-z0-9]+(?:-[a-z0-9]+)*$`; tags SHALL be a nonempty list of nonempty strings; sync SHALL be `add` or `overwrite`. Types, dates, and text values SHALL retain PR #390's validation contract except for the environment enum. Missing descriptions SHALL use the existing programming excerpt behavior. An `image` value SHALL be text and SHALL use the same reference forms and resolution rules as a body image. Environment SHALL be exactly `nonprod` or `production`. Production builds SHALL include only production-target posts; staging, PR previews, and local builds SHALL include both targets, subject to draft and validation rules. Migration SHALL explicitly map legacy `prd` to `production` and legacy `pr`/`local` to `nonprod`; the new parser SHALL reject legacy aliases.

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

#### Scenario: A post sets an image

- **WHEN** a post's metadata includes `image: image/1-high-level-workflow.png` and that image exists below `image/`
- **THEN** the post SHALL be valid and that image SHALL be its social preview image

#### Scenario: An image value is not text

- **WHEN** a post's `image` value is a list or other non-text value
- **THEN** only that file revision SHALL fail validation as invalid metadata

### Requirement: Image delivery preserves publication privacy and production caching

The publisher SHALL accept lowercase `.jpg`, `.png`, and safe `.svg` images below `image/`, validate file signatures and static SVG content, and enforce the existing 20 MiB per-image limit. Standard relative Markdown images, supported Obsidian image embeds, and the `image` metadata value SHALL resolve within that tree. Images SHALL use immutable SHA-256 object keys and verified size, content type, and hash metadata before becoming available to publication. Source image uploads SHALL remain private. Only image objects referenced by the effective accepted nondraft production collection SHALL be eligible for public promotion; invalid, nonprod, draft, and unused source references SHALL not independently authorize promotion.

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

- **WHEN** a reference, including an `image` metadata value, lacks a usable manifest entry or verified destination metadata
- **THEN** the build SHALL omit only that reference, report its issue privately, and retain the post body and other valid references

#### Scenario: An image is referenced only by metadata

- **WHEN** a valid accepted nondraft production post names a verified private image in `image` and does not use it in the body
- **THEN** that image SHALL be eligible for public promotion and the production workflow SHALL verify its public destination before deploying the page

#### Scenario: A nonprod or draft post names an image in metadata

- **WHEN** an image is named only by the `image` value of a nonprod or draft post and has never been published
- **THEN** it SHALL remain absent from public media storage and public artifacts
