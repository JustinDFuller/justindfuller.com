# Proposal

## Why

An Obsidian edit with a single invalid front matter value (`environment: prod`) was rejected, and nobody noticed. The pipeline kept the previous version of the post, wrote the reason only to a private report, left the GitHub run green, and showed a five-second toast reading `staging: markdown_metadata` about 95 minutes after the save. The person editing saw nothing wrong until they went looking for their changes. A rejected edit must be as hard to miss as a failed build.

## What Changes

- The Obsidian publisher keeps a notice on screen for each unresolved publication issue until the issue is resolved or the person dismisses it. The notice names the note, gives a readable reason, and says which targets are still serving the previous version. A status bar item summarizes the number of open issues and reopens the details.
- The protected private report retains the human-readable issue reason so the publisher can show it. It stays private; public output is unchanged in what it may contain.
- Each hosted target run publishes a sanitized warning annotation and a step summary line with counts by safe category only (for example `staging: 1 file kept at its previous version (markdown_metadata)`).
- A target run that finds blocking content issues concludes as **failed** after it has finished publishing. Invalid content still does not block publication: valid posts build, deploy, and verify as before. The failure is reported at the end, so "blocked" and "failed" stay separate concepts.
- Blocking categories are Markdown validation failures, retained last-known-good fallbacks, route collisions, and overwrite-target conflicts. Image-not-ready issues only warn, because they resolve themselves when the image finishes uploading.
- A run that skips its build because every changed file was rejected still concludes as failed.
- The next run without blocking issues concludes successfully, and the publisher reports recovery and clears its notices.
- Not in this change: validating front matter inside the plugin before upload, and accepting `prod` as an alias for `production`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `obsidian-programming-sync`: the protected-diagnostics requirement changes to allow a retained plain-text reason per issue and to point at persistent publisher notices. Three requirements are added: issues stay visible in Obsidian until resolved, public run output reports sanitized issue counts, and rejected content concludes the run as failed without blocking valid publication.

## Impact

- Scripts: `scripts/record-obsidian-publication.mjs` and `scripts/obsidian-reports.mjs` (retain and validate the reason), `scripts/prepare-obsidian-target.mjs` (sanitized counts by category and warning output).
- Workflow: `.github/workflows/obsidian-target.yml` gains a final job that fails the run when blocking issues exist, after deploy and verification.
- Obsidian plugin: `tools/obsidian-image-publisher` status handling and notification surface, plus a status bar item.
- Go preparer: no behavior change; it already produces the reasons.
- Privacy: public logs and summaries remain limited to counts and safe categories; reasons and note names appear only in the private report and inside Obsidian.
- Operations: runs triggered by code pushes, including Dependabot pushes to the default branch, turn red while invalid vault content is present. Pull request checks are not affected by vault content.
