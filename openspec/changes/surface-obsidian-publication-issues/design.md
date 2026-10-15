# Design

## Context

See proposal.md for motivation. The pipeline already detects rejected edits precisely: the Go preparer attaches a readable message, category, file path and fallback to each issue. Three hand-offs lose or hide it:

- The protected report writer copies only key, category, file identity, path, revision, route, fallback and observation time. The message is dropped, so the Obsidian publisher can only print the category.
- The Obsidian publisher turns each new issue into a transient notice (`<target>: <category>`) once per issue and never again.
- The target workflow ends green whenever preparation succeeds. A rejected edit that leaves effective content unchanged also skips build and deploy, so the run looks like "nothing to do".

Constraints: the repository is public, so run output may carry only counts, opaque revisions and safe categories. Private identifiers (note names, reasons) may appear only in the protected report and inside Obsidian. Isolated failures must keep publishing valid content (existing requirement).

## Goals / Non-Goals

**Goals:**

- Put the note name and a readable reason in front of the author, in Obsidian, until the problem is resolved.
- Make a run that rejected content visibly red without delaying or blocking any valid publication.
- Keep all public output free of private identifiers.

**Non-Goals:**

- Validating front matter in the plugin before upload.
- Accepting legacy aliases such as `prod`.
- Changing which edits the preparer accepts or rejects, or the last-known-good behavior itself.
- Failing pull request checks, or any check other than the staging and production target runs.

## Decisions

### Keep the reason in the protected report only

The report writer adds the issue message to its allowed fields and the report reader validates it as bounded plain text (length-capped, control characters rejected). Reports are private and already contain note paths, so adding the reason does not widen who can read it. The Go issue type is unchanged.

Alternative: derive the reason in the plugin from the category. Rejected: a category like `markdown_metadata` cannot say which key or value is wrong, and duplicating the rule texts in the plugin invites drift.

### Persist notices through plugin state, not through the transient toast

The plugin already keeps a durable per-target set of seen issue fingerprints. This change extends that state to hold the current unresolved issues per target (note path, reason, fingerprint), each with a dismissed flag. Each report read replaces the target's unresolved set. Obsidian's notice object is created with no timeout for an undismissed issue, and a status bar item shows the count and opens the same details. When a verified report no longer contains an issue it is removed and the existing "publication recovered" message is shown. A dismissed issue stays hidden while its fingerprint is unchanged.

Notices that name several targets are merged by note and reason so the same rejection in staging and production produces one notice.

Alternative: a longer toast. Rejected: any timeout can pass while the author is away, and the staging prepare of the failing edit ran about 95 minutes after the save.

### Count blocking issues in the prepare step; fail in a final job

The prepare script already receives the full diagnostics. It additionally writes sanitized per-category counts (never paths, slugs or reasons) to the job outputs, a warning annotation and the step summary. The same script classifies categories as blocking or warning-only: blocking are the `markdown_*` categories, `last_known_good`, `route_collision` and `overwrite_target`; `image_not_ready` and other self-healing conditions warn only. Source-wide failures such as `source_degraded` keep their existing handling and are not changed here.

A new final job in the target workflow needs prepare, build and deploy, runs even when build and deploy are skipped or fail, and exits non-zero with an error annotation when the blocking count is above zero and prepare succeeded. Because it only runs after deploy and verification finish, valid content publishes first and the failure never blocks publication. It is scoped to staging and production target runs; preview and pull request checks do not include it.

Alternative: fail inside prepare or deploy. Rejected: it would stop valid posts from publishing, contradicting the isolated-failure requirement. Alternative: warn only. Rejected: a green run is what hid the original failure.

### Failed runs on unrelated pushes are accepted

Target runs also execute for code pushes, including Dependabot pushes to the default branch, so those runs turn red while invalid vault content exists. This is intended: the content is still unpublished. Pull request checks are unaffected, so merging dependency updates is not blocked.

## Risks / Trade-offs

- Autosave captures half-typed front matter, so a transient invalid state can upload, turn a run red, and show a notice → the next valid upload turns the run green and the notice clears automatically; the dismissed state also clears on recovery.
- A persistent red run could be ignored or hide a different failure → the sanitized summary names the category and count, and the persistent notice carries the specifics.
- Reasons may contain note-derived text (for example a bad front matter value) → they exist only in the private report and the plugin; public output never receives them, and a test must assert that.
- Longer reasons could bloat the report that has a 2 MiB cap → cap each reason's length and keep the existing size check.
- Retained dismissal state could hide a recurring problem → dismissal is keyed to the fingerprint and cleared on recovery.

## Migration Plan

1. Land the report field and reader validation first. Older reports without a reason stay valid; the plugin falls back to the category text.
2. Ship the plugin update; it reads both old and new reports.
3. Land the workflow job and prepare output together so a run never fails without its sanitized summary.
4. Rollback by removing the final job; the other changes are additive.

## Open Questions

- Whether the status bar item should also show a distinct state while a target run is still queued. This is deferrable and does not change the specs.
