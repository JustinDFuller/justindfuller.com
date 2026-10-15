# Tasks

## 1. Retain readable reasons in the protected report

- [ ] 1.1 Add the issue message to the fields kept by `protectedPublicationReport` in `scripts/record-obsidian-publication.mjs`, capped in length, and verify with a test in `scripts/record-obsidian-publication.test.mjs` that the report contains the reason and stays under the size limit
- [ ] 1.2 Validate the reason as bounded plain text in `scripts/obsidian-reports.mjs`, accepting older reports that lack it, and verify in `scripts/obsidian-reports.test.mjs` that oversize or control-character reasons are rejected and old reports still load
- [ ] 1.3 Verify in `scripts/obsidian-publication-privacy.test.mjs` that the reason never reaches any public output path (logs, summaries, artifacts, comments)

## 2. Sanitized public run output

- [ ] 2.1 Classify issue categories as blocking or warning-only in `scripts/prepare-obsidian-target.mjs` and emit sanitized per-category counts and a blocking total as job outputs; verify with a test in `scripts/prepare-obsidian-target.test.mjs` covering metadata failures, last-known-good fallbacks, route collisions, overwrite-target conflicts, and image-not-ready
- [ ] 2.2 Emit a warning annotation and a step summary line stating target, count and category only; verify with a test that output for a fixture with a private path, slug, title and reason contains none of them and that a clean fixture emits no warning

## 3. Fail the run after publishing

- [ ] 3.1 Add a final job to `.github/workflows/obsidian-target.yml` that needs prepare, build and deploy, runs even when build and deploy are skipped, and fails with an error annotation when the blocking total is above zero; verify with `scripts/obsidian-workflow.test.mjs` that the job ignores build outcomes, does not gate deploy, and applies only to staging and production
- [ ] 3.2 Verify in `scripts/obsidian-workflow.test.mjs` that preview and pull request paths do not include the job, and that an image-not-ready-only run passes

## 4. Persistent notices in the Obsidian publisher

- [ ] 4.1 Extend the status state in `tools/obsidian-image-publisher/src/status.ts` to hold unresolved issues per target with path, reason, fingerprint and dismissed flag, merging identical issues across targets; verify with tests in `tools/obsidian-image-publisher/tests/status.test.ts` for creation, merge, dismissal by fingerprint, recovery, and old reports without a reason
- [ ] 4.2 Show a non-expiring notice for each undismissed issue naming the note, reason and affected targets, and a status bar item with the count that reopens the details, in `tools/obsidian-image-publisher/src/main.ts`; verify with tests in `tools/obsidian-image-publisher/tests/main.test.ts` that notices persist across polls without repeating, clear on recovery, and the status bar count updates
- [ ] 4.3 Update the plugin's user documentation for the notices and status bar item and verify the documented behavior matches the tests

## 5. End-to-end proof

- [ ] 5.1 With a throwaway nonprod note holding an invalid `environment` beside a valid edit, verify the valid edit deploys to staging, the run is red, the public summary shows only counts and categories, and Obsidian shows the persistent notice; record screenshots in the PR description
- [ ] 5.2 Fix the throwaway note and verify the next run is green, the notice clears with "publication recovered", and the status bar item disappears; confirm public logs contain no filename, slug or reason from the throwaway note

## Workflow follow-up

- Archive the change after review requirements are satisfied.
- Verify the archived specification contains the added and modified requirements.
