# Proposal

## Why

An Obsidian note with `section: thought` is rejected with "section must be programming", so the owner can only write programming posts from Obsidian. Thought posts are the closest sibling section, and publishing them the same way removes the need to edit the repository for them.

## What Changes

- Obsidian notes may set `section` to `thought` as well as `programming`. Any other section is still rejected, and the error names the two allowed sections.
- A thought note follows the same contract as a programming note: the same required and optional fields, the same `nonprod` and `production` targets, drafts, `add` and `overwrite` sync, body images, last-known-good fallback, and issue notices.
- A post's route identity becomes its section plus its slug, so a programming post and a thought post can share a slug without colliding.
- A published thought post appears at `/thought/<slug>`, on the `/thought` list, and in the sitemap. An `overwrite` thought note replaces the Git-backed thought post with exactly that slug, and removing the note restores the Git version.
- A thought note may set `image` like a programming note. Thought pages declare a social preview image the same way programming pages do: the note's `image` value first, then the first image in the body. This applies to every thought post, so Git-backed thought posts that already contain images gain a preview image too.
- Issue notices name the section of the affected route instead of always saying "programming".
- Out of scope: every other section (review, story, poem, word, nature, aphorism, about) and any change to the Obsidian plugin or the publishing workflows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `obsidian-programming-sync`: the accepted `section` values, route identity, and the merge of external entries now cover thought posts as well as programming posts.
- `social-preview-images`: thought posts declare a social preview image, chosen in the same order as programming posts.

## Impact

- Go: `obsidian/` (metadata validation, publication policy, preparation, fallback, image promotion, report) and `site/` (thought list and post routes, preview image tags, static export, sitemap), plus `cmd/prepare-obsidian`.
- Documentation: `docs/obsidian-cloudflare.md` post metadata section.
- No change to the Obsidian plugin, GitHub workflows, Cloudflare configuration, or stored accepted state; existing accepted programming state keeps working.
- Human-facing: the thought list and post pages, the preview image tags on thought pages (including the four Git-backed thought posts that contain images), and the Obsidian notice text. Both are validated with computer use against the real app, with proof recorded in the change's `qa.md`.
