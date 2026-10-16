# QA

This file records the proof for tasks 5.1 to 5.3. The checks were run on 2026-10-15 against the implementation merged to `main` as `bf6ceb6` (pull request 421), using the real Obsidian app driven by Claude Code computer use and real "Build and Deploy to Cloudflare" runs on `main` that the installed plugin dispatched.

## Setup

- The plugin built from the merged implementation (version still 0.1.0) was installed into the vault through the Finder GUI. Only `main.js`, `manifest.json` and `keyring.darwin-arm64.node` were replaced, so the plugin settings and state files were untouched. The plugin was reloaded in Obsidian with an off and on toggle. Automatic publishing was on.
- Two throwaway notes were created in the vault root and then moved into the plugin's source folder. Both had `section: programming`, `date: 2026-10-15`, `draft: false`, `sync: add` and a `programming` tag.
  - "QA Valid Nonprod" had `environment: nonprod` and the slug `qa-surface-issues-valid`.
  - "QA Rejected Note" first had `environment: invalid` and the slug `qa-surface-issues-invalid`.
- The existing real post was not edited. Staging and production credentials were not needed, because the plugin dispatches the runs itself.

## Task 5.1: rejected note beside a valid edit

All times are UTC.

| Step                                                      | Run         | Dispatched | Result                                                                                                                                                                                                                             |
| --------------------------------------------------------- | ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid note only                                           | 38745656310 | 13:47:06   | Success. Staging resolve, validate, prepare, build and deploy succeeded. Production build and deploy were skipped because the note is nonprod. Both `conclude` jobs were skipped. Obsidian showed "staging: publication verified". |
| Rejected note moved into the source folder                | 38747780126 | 14:01:52   | Failure, completed 14:11:12. Both `production / conclude` and `staging / conclude` failed. Build and deploy were skipped because the prepare step found nothing new to build.                                                      |
| Valid note edited while the rejected note stayed rejected | 38749579917 | 14:14:10   | Failure, completed about 14:21:51. `staging / build` and `staging / deploy` succeeded, and then both `conclude` jobs failed.                                                                                                       |

- The last row is the scenario the spec asks for: the valid edit deployed to staging and the run still ended red because of the rejected note.
- The failing `conclude` jobs carry only annotations. The annotation reads "Obsidian content rejected" and "1 rejected file(s) are still serving a previous version or are unpublished. Categories: {"markdown_metadata":1}". It gives a count and a category and nothing else.
- A search of the full public logs of runs 38747780126 and 38749579917 for both note names, both slugs and the rejection reason found no matches.

Obsidian, observed with computer use:

- A persistent notice appeared that names the note, the reason and the target: "environment must be nonprod or production. Still serving the previous version on production". After a later poll it was updated to name staging and production. It was not repeated or stacked: there was one notice after the 14:21 poll.
- The status bar showed "1 publication issue". Clicking it reopened a "Publication issues" dialog with the same text.

Screenshots, cropped to the notice, the status bar item and the dialog:

- `qa/notice-rejected-note.png` shows the persistent notice naming staging and production.
- `qa/status-bar-one-issue.png` shows the status bar item with the count.
- `qa/details-dialog.png` shows the reopened details dialog.

## Task 5.2: fixing the note

- The rejected note's front matter was edited to `environment: nonprod` at about 14:22 UTC.
- Run 38751114593 was dispatched at 14:24:31 and completed at 14:31:56 with success. Staging build and deploy succeeded, production build and deploy were skipped, and both `conclude` jobs were skipped.
- A search of that run's full public log (4116 lines) for both note names, both slugs and the rejection reason found no matches.
- At 14:32 UTC the Obsidian status bar no longer showed a publication issue item, and the note was still open. `qa/status-bar-recovered.png` shows the status bar after the recovery.

## Cleanup

- Both throwaway notes were deleted in Obsidian, which moves them to the system trash. Only these two notes were deleted.
- The deletions dispatched run 38752592814 at 14:34:21 UTC, which completed with success at 14:42:27. Staging build and deploy succeeded, production build and deploy were skipped, and both `conclude` jobs were skipped.
- Whether staging stopped serving the two throwaway pages after that run was not checked, because the staging address was not inspected.

## Difficulties and failed attempts

- The Mac screen locked at about 13:35 UTC. The work stopped until the user unlocked it, and nothing was done to get around the lock.
- The first attempts to create the notes through the Properties editor produced a stray property called "aliasese", and Obsidian auto-closed the front matter and auto-continued lists. They were fixed by undoing the edits, switching to Source mode and using inline tags.
- Replacing the plugin files in Finder needed a "Replace All" answer the first time.
- The Obsidian window repeatedly ended up behind a Finder window that shows personal files. No screenshot that included those files was kept.
- The "Move file to…" dialog opened late, and typing the folder name too early put "Blog" at the end of the rejected note's body.
- The first move into the source folder was not dispatched until a later edit. One typed edit never appeared in the note, and a run was dispatched anyway.
- The first cropped screenshots were off because of a scale mismatch between screenshot and display coordinates. They were recaptured.

## What this evidence does not prove

- Only one note was rejected at a time. Several rejected notes, several categories and an image that is not ready were not exercised end to end. Unit tests cover them.
- The 5.1 check ran across two runs: run 38747780126 proved the red run with the rejected note, and run 38749579917 proved the valid edit deploying while the note stayed rejected.
- The "publication recovered" notice was a transient toast and was not on screen when it was checked, so it was not captured. The recovery is evidenced by the green run and by the status bar item having disappeared. The wording itself is covered by unit tests.
- The status bar screenshot was taken while the notice named only production, and the notice screenshot was taken after it also named staging.
- Whether the persistent notice survives restarting Obsidian was not tested.
- Production was not exercised, because both throwaway notes were nonprod. The production conclusion is shown only through the `production / conclude` job failing in run 38747780126.
- The `private-preview / prepare` job of the `pull_request_target` run fails at "Pin the current private source with trusted main code". It fails the same way on the docs-only proposal pull request, so this is an environmental problem and not part of this change.
- The "Still serving the previous version on…" wording comes from the spec and is not accurate for a note that was never published.

## Automated checks

- 229 tests ran locally on the implementation branch: 226 passed and 3 were skipped because they need Linux. The plugin type check, Prettier and Markdown lint passed, and `openspec validate surface-obsidian-publication-issues` reported the change as valid.
- Three fresh-context adversarial reviews and one scope check were run. Their findings were fixed or are listed in the pull request description.
