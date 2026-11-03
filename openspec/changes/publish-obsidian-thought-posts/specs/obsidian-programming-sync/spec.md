# Spec Delta

## ADDED Requirements

### Requirement: Thought notes publish through the same contract as programming notes

A note whose section is `thought` SHALL be validated, targeted, drafted, synchronized, image-resolved, retained as last-known-good, and reported exactly as a programming note is, except where this specification says otherwise. Its slug SHALL be its route under `/thought/`. Rendered thought pages SHALL use the existing thought list and post templates and SHALL NOT load code-highlighting styles.

#### Scenario: A thought note is added

- **WHEN** a valid nondraft `thought` note with `sync: add` targets an environment eligible for the build and its slug is unclaimed
- **THEN** the build SHALL serve it at `/thought/<slug>`, list it on `/thought` in date order with the Git-backed thought posts, and include it in the sitemap

#### Scenario: A thought note overwrites a Git post

- **WHEN** a valid `thought` note with `sync: overwrite` has the slug of exactly one Git-backed thought post, which is that post's filename without `.md`
- **THEN** the build SHALL serve the note's content at that post's route, list, and sitemap entry in place of the Git version

#### Scenario: A thought overwrite is removed

- **WHEN** a complete activated source revision omits a previously accepted thought overwrite note
- **THEN** the next successful publication SHALL restore the Git-backed thought route, list entry, and sitemap URL

#### Scenario: A thought draft is present

- **WHEN** a valid draft thought note is eligible for the build
- **THEN** it SHALL be absent from pages, lists, and sitemaps, and a draft overwrite SHALL mask the matching Git thought route without exposing its Git fallback

#### Scenario: A thought note is nonprod

- **WHEN** a valid nondraft thought note targets `nonprod`
- **THEN** it SHALL be eligible in local, PR, and persistent staging builds and SHALL remain absent from production routes, lists, and sitemap

#### Scenario: A thought note's content is invalid

- **WHEN** a thought note's new revision fails Markdown validation while an earlier revision was accepted
- **THEN** the previous accepted revision SHALL remain published and the failure SHALL be reported as a blocking issue

### Requirement: Thought notes may set a preview image

A `thought` note MAY set `image` with the same value forms, validation, and resolution rules as a programming note. A valid accepted production thought note's `image` file and body images SHALL be eligible for public promotion by the same rules as programming images. The thought page SHALL choose its social preview image as the `social-preview-images` specification describes.

#### Scenario: A thought note sets image

- **WHEN** a valid nondraft thought note sets `image` to an existing file below `image/`
- **THEN** the note SHALL be valid and that image SHALL be its social preview image

#### Scenario: A thought note sets an unusable image

- **WHEN** a thought note's `image` value is not text, or does not resolve to a file below `image/`
- **THEN** the failure SHALL be handled exactly as it is for a programming note, affecting only that file revision

#### Scenario: A thought note has a body image

- **WHEN** a valid accepted nondraft production thought note references a verified private image in its body
- **THEN** that image SHALL be eligible for public promotion and the thought page SHALL display it

### Requirement: A route moves with its note's section

When a previously accepted note's section changes between `programming` and `thought`, the system SHALL remove the note's ownership of its old route before considering fallback, and SHALL publish it under the new section only if it is valid there.

#### Scenario: A note moves from programming to thought

- **WHEN** a previously accepted programming note is edited into a valid thought note with the same slug
- **THEN** the programming route SHALL no longer be owned by the note, restoring a matching Git overwrite fallback or removing an additive route, and the thought route SHALL be published

#### Scenario: A note moves to a section where it is invalid

- **WHEN** a previously accepted note changes its section and the new revision fails validation or collides in the new section
- **THEN** the new revision SHALL be reported as a blocking issue and the note SHALL retain its last-known-good revision in its previous section

### Requirement: Route issues name the section

Diagnostics and notices for route collisions, overwrite-target conflicts, and retained last-known-good fallbacks SHALL name the section of the affected route. Public run output SHALL continue to contain only the counts and categories the existing requirements allow.

#### Scenario: A thought overwrite has no target

- **WHEN** a thought note with `sync: overwrite` matches no Git-backed thought post
- **THEN** its protected diagnostic SHALL say that no matching thought route exists and the note SHALL remain unpublished

#### Scenario: Public output after a thought issue

- **WHEN** a hosted target run retains a thought note at its previous revision
- **THEN** the run's warning and summary SHALL contain only the target, the count, and the category

## MODIFIED Requirements

### Requirement: Programming metadata defines nonprod and production targets

Each Markdown post SHALL require exactly `environment`, `section`, `slug`, `title`, `date`, `draft`, `sync`, and `tags`, with optional `subtitle`, `description`, and `image`. Unknown keys SHALL be invalid. The section SHALL be `programming` or `thought`; the slug SHALL match `^[a-z0-9]+(?:-[a-z0-9]+)*$`; tags SHALL be a nonempty list of nonempty strings; sync SHALL be `add` or `overwrite`. Types, dates, and text values SHALL retain PR #390's validation contract except for the environment enum. Missing descriptions SHALL use the existing programming excerpt behavior. An `image` value SHALL be text and SHALL use the same reference forms and resolution rules as a body image. Environment SHALL be exactly `nonprod` or `production`. Production builds SHALL include only production-target posts; staging, PR previews, and local builds SHALL include both targets, subject to draft and validation rules. Migration SHALL explicitly map legacy `prd` to `production` and legacy `pr`/`local` to `nonprod`; the new parser SHALL reject legacy aliases.

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

#### Scenario: A section is not supported

- **WHEN** a note's section is neither `programming` nor `thought`
- **THEN** only that file revision SHALL fail validation, the protected diagnostic SHALL state that the section must be programming or thought, and unrelated valid files SHALL remain publishable

### Requirement: External entries preserve Git content and route ownership

The system SHALL merge eligible Obsidian entries into their section's list, direct routes, and sitemap without modifying Git files. Route identity SHALL be the note's section plus slug. An `add` entry SHALL require an unclaimed local and external route in its section. An `overwrite` entry SHALL match exactly one Git entry in its section. Conflicting external claims SHALL be reported and SHALL not depend on discovery order. Removing a file from a complete source revision SHALL remove its external ownership: additive posts disappear and overwritten Git posts return. Homepage feature posts SHALL remain unaffected.

#### Scenario: An overwrite is removed

- **WHEN** a complete activated source revision omits a previously accepted overwrite file
- **THEN** the next successful publication SHALL restore the Git-backed route, list entry, and sitemap URL

#### Scenario: Two files claim one route

- **WHEN** multiple eligible external files claim the same route
- **THEN** the system SHALL report the conflict and SHALL retain the previously accepted route resolution, or the Git-backed resolution if none exists, while publishing unrelated changes

#### Scenario: Two sections use one slug

- **WHEN** a programming note and a thought note have the same slug
- **THEN** each SHALL own only its own section's route, neither SHALL be reported as a collision, and each Git-backed post SHALL be matched only within its own section
