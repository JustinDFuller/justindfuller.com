# Design

## Context

The publishing pipeline in `obsidian/` was written for one section. A candidate note carries a `programming.Entry`, and route identity is the bare slug in the publication policy, preparation, fallback revalidation, and image promotion. `Prepared` holds one list of programming entries (the merged Git and Obsidian list) and one list of masked slugs. The server and static export read thought posts from disk on every request, with no overlay. See `proposal.md` for motivation and `specs/obsidian-programming-sync/spec.md` for the requirements.

Thought posts are close to programming posts. Both are single Markdown files with `title`, `subtitle`, `date`, `draft`, and `tags` front matter and a slug taken from the filename. The differences that matter are that `thought.Entry` has no draft flag, no image field, and no first-paragraph field, and that the thought handler resolves a request by filename suffix.

Accepted state stores raw note bytes keyed by file, and revalidation re-derives everything from them. That is what lets old accepted programming state keep working with no migration.

## Goals / Non-Goals

**Goals:**

- A `section: thought` note publishes through every existing mechanism: targets, drafts, add and overwrite, body images, last-known-good, reports, and notices.
- Keep the change small: reuse the existing validation and rendering path, and add thought data beside the programming data instead of generalizing every type.
- Existing accepted state, prepared documents for programming-only sources, the plugin, and the workflows keep working unchanged.

**Non-Goals:**

- Other sections, or a generic section registry. Adding the next section should be a separate, small change that follows this one's pattern.
- Any change to the visible thought page layout. Only meta tags are added.
- Changing how Git-backed thought posts are loaded when no overlay is in use.

## Decisions

### Route identity is section plus slug, expressed as one key

Wherever the pipeline keys by slug (grouping candidates, local route counts, `replaced`, last-known-good matching, promotion), it will key by `section/slug` instead. `candidate` gains a `Section` field set by `parseMetadata`, which now accepts exactly `programming` and `thought`.

Alternatives: keep bare slugs and refuse a slug used in both sections. Rejected because it makes an unrelated programming post block a thought slug, and the spec's route identity would no longer match the URLs.

### The rendered entry keeps the programming shape inside the pipeline

`validateMarkdown` keeps producing a `programming.Entry` for both sections, since rendering, escaping, excerpts, and image rewriting are identical. The conversion to `thought.Entry` (title, subtitle, slug, description, content, date, image) happens only when an accepted candidate is added to the prepared result. Draft candidates never become entries, which is why `thought.Entry` needs no draft flag.

Alternatives: a common entry interface across packages, or a thought-specific validator. Both add surface area for no behavior gain.

### Prepared gains thought fields next to the programming ones

`Prepared` adds `ThoughtEntries` and `ThoughtMasks`, tagged `omitempty`. `ThoughtEntries` is the merged list, as `Entries` is today: Git thought posts that were not replaced or masked, plus accepted Obsidian thought posts, newest first. `Prepare` and `PrepareAccepted` take the Git thought posts as input alongside the Git programming posts (a small struct rather than a second positional slice). The prepared digest, `ValidatePrepared` (unique non-empty routes per section), `ReportPrepared`, and `ValidateImagePromotion` include the thought fields.

Because the new fields are `omitempty` and `State` is unchanged, a source with no thought notes produces the same digest and the same accepted state as before. Old accepted state loads and revalidates as it does now.

Alternatives: a single `Entries` list of a tagged union, or section-qualified strings in `Masks`. Both change the shape existing prepared documents, the report, and the JS scripts already read. Separate fields leave those shapes untouched.

### Serving: overlay mode uses the merged thought list, exact slug lookup

`newWithEntries` takes the programming entries and an optional merged thought list. With no overlay it calls the thought package as it does today, so repo-only behavior (including suffix matching) is unchanged. With an overlay it renders `/thought` from the merged list and serves `/thought/<slug>` by exact slug, returning not found for anything else. The static export and sitemap use the same merged list.

Static exports have only ever produced exact-slug pages, so deployed behavior does not change. The one visible difference is the local server running with an overlay, where a partial filename such as `/thought/impostor-syndrome` no longer resolves.

Alternatives: keep suffix matching in overlay mode by consulting the overlay after resolving the Git post. Rejected because it adds a second resolution path to guard against masked or overwritten posts, for an address style that is never published.

### Thought pages choose a preview image like programming pages

`thought.Entry` gains an `Image` field, filled from a thought note's resolved `image` value and left empty for Git-backed thought posts. `validateMarkdown` already resolves and validates `image` for both sections, so `parseMetadata` needs no section-specific rule. The preview choice in `site/preview.go` takes the image value and rendered content instead of a `programming.Entry`, and the thought entry handler passes the result to the shared meta template, which already emits `og:image`, `og:image:alt`, and `twitter:card` when an image is set.

The order is the one programming uses (the `image` value, then the first body image) and applies to every thought post in every environment. Four Git-backed thought posts contain images, so they begin declaring a preview image. Image promotion treats a thought note's `image` value like a programming one: it is authorized only for accepted production thought notes.

Alternatives: preview images only for Obsidian thought notes with an explicit `image`, which leaves Git posts unchanged but needs a second rule and a flag to tell the two apart. Or accept `image` and ignore it, which promotes files publicly for no effect.

### A section change is a route change

Last-known-good matching already compares slugs for a note. It will compare route keys, so a note edited from one section to the other drops its old route ownership first, as a valid target change does. If the new revision is invalid in the new section, the previous accepted revision stays in its previous section.

### Issue messages are built from the section

The policy messages ("…the same programming route") are produced from the candidate's section. `Issue.Route` stays the bare slug, and the existing fields and categories are unchanged, so the plugin, the report scripts, and the sanitized public counts need no change.

## Risks / Trade-offs

- [A missed spot still keys by bare slug and lets a programming and a thought note interfere] → The spec has a same-slug scenario, and the tasks add tests for the shared slug through preparation, fallback, and promotion.
- [Thought Git posts are loaded in more places, and a load failure now affects preparation] → Treat a failure to load Git thought posts like a failure to load Git programming posts: stop with an error, never silently publish an empty list.
- [`thought.Entry` descriptions are built differently from programming excerpts] → Obsidian thought notes use the same excerpt behavior as programming notes, so the list excerpt can differ slightly from Git-backed thought posts. This is accepted for consistency with the single validator.
- [Four existing Git-backed thought pages gain `og:image` and `twitter:card` tags] → Intended, for one rule across sections; invisible on the page itself, and checked in the proof.
- [Local overlay server stops resolving partial thought filenames] → Accepted and documented; the published site never served them.

## Migration Plan

No data migration. Merge, and the next reconciliation accepts thought notes. To roll back, revert the change; thought notes already accepted stay in private state and are simply not rendered, and nothing is deleted.
