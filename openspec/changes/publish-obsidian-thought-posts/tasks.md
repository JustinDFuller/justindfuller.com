# Tasks

## 1. Accept the thought section and key routes by section

- [ ] 1.1 In `obsidian/validate.go`, make `parseMetadata` accept `programming` or `thought`, record the section on `metadata` and `candidate`, reject `image` for `thought` notes as invalid metadata, and change the unsupported-section error to "section must be programming or thought"; verify with tests in `obsidian/prepare_test.go` for a valid thought note, an unsupported section (isolated failure, message text), a thought note with `image`, and that a programming note with `image` is still valid
- [ ] 1.2 Key route identity by `section/slug` in `obsidian/policy.go`, `prepare.go`, `fallback.go`, and `promotion.go` (grouping, local route counts, replaced routes, last-known-good matching), and build the collision, overwrite-target, and fallback messages from the candidate's section; verify with tests in `obsidian/prepare_test.go` and `obsidian/fallback_test.go` that a programming note and a thought note sharing a slug do not collide, that two thought notes claiming one slug do collide with a thought-named message, and that an overwrite matches only a Git post in its own section
- [ ] 1.3 Handle a note that changes section: its old route ownership is removed first, it publishes in the new section only if valid there, and otherwise keeps its last-known-good revision in the old section; verify with tests in `obsidian/prepare_test.go` for a valid move and an invalid move

## 2. Carry thought entries through preparation

- [ ] 2.1 Add `ThoughtEntries` and `ThoughtMasks` (both `omitempty`) to `Prepared` in `obsidian/types.go`, convert accepted thought candidates to `thought.Entry` when they are added to the result, and merge in the Git thought posts that are not replaced or masked, newest first; change `Prepare` and `PrepareAccepted` to take the Git programming and thought posts together; verify with tests in `obsidian/prepare_test.go` and `obsidian/fallback_test.go` that add, overwrite, draft mask, nonprod versus production eligibility, and source-outage revalidation produce the expected thought lists
- [ ] 2.2 Include the thought fields in the prepared digest, `ValidatePrepared` (non-empty slugs without path characters, unique per section), and `ReportPrepared` (including the section of each file and thought masks); verify with tests in `obsidian/prepare_test.go` and `obsidian/report_test.go` that a source with no thought notes yields the same digest, report JSON, and accepted state as before this change, that tampered thought entries fail validation, and that old accepted programming state still loads
- [ ] 2.3 Extend `ValidateImagePromotion` in `obsidian/promotion.go` so images in accepted production thought notes are authorized and checked against `ThoughtEntries`, and unused or nonprod thought images are not; verify with tests in `obsidian/promotion_test.go`
- [ ] 2.4 In `cmd/prepare-obsidian/main.go`, load the Git thought posts next to the Git programming posts (via a new loader in `site/` beside `LoadProgramming`) and fail preparation if either cannot be loaded; verify with `go build ./...` and a test in `cmd/prepare-obsidian` or `site/` that a load failure stops preparation

## 3. Serve and export thought posts

- [ ] 3.1 Change `newWithEntries` and `NewWithPrepared` in `site/site.go` to accept the merged thought list; with an overlay, render `/thought` from it and `/thought/<slug>` by exact slug, and without an overlay keep calling the thought package; verify with HTTP tests in `site/` and `main_test.go` that an added thought note, an overwrite, a masked draft overwrite (not found), and a Git thought post render as expected, and that repo-only mode still resolves the existing thought routes
- [ ] 3.2 Change `pagePathsWithEntries` and `ExportWithPrepared` in `site/export.go` to use the merged thought list for pages and the sitemap; verify with tests in `site/export_test.go` that an added thought note appears in pages and the sitemap, a masked or removed one does not, and that the repo-only export is unchanged (`TestStaticExportMatchesServer` still passes)
- [ ] 3.3 Document `section: thought` in `docs/obsidian-cloudflare.md` under "Post metadata": the allowed sections, that the slug is the route, how overwrite matches a Git thought post by filename, that thought notes cannot set `image`, and the local-overlay exact-slug behavior; verify that `make lint-md` passes and that a documented example note is covered by a fixture in `obsidian/prepare_test.go`
- [ ] 3.4 Run `go test ./...`, `make build`, and `npm run test`, and verify all pass with no comments or lint findings added

## 4. End-to-end proof

Proof is gathered from the real running system and recorded in `qa.md` in this change folder, with screenshots under `qa/` and repeated in the PR description. This repository is public, so screenshots must show only throwaway test notes and no private vault content; any that do are recaptured, not redacted.

- [ ] 4.1 Create a throwaway vault outside the repository with a `nonprod` thought note (`sync: add`), a `nonprod` thought overwrite of an existing Git thought post, a draft thought note, a thought note with `image`, and a note with `section: poem`; prepare it with `node scripts/prepare-local-obsidian.mjs --vault <vault>`, run the site with `OBSIDIAN_OVERLAY`, and verify with `curl` that `/thought` lists the added and overwritten notes, their pages render with the thought template and no `og:image`, the draft is not found, and the preparer reports exactly the `image` and `poem` notes as issues; record commands and output in `qa.md`
- [ ] 4.2 Use Claude Code computer use to open the local `/thought` list and the added and overwritten thought pages in a browser and screenshot them; verify the new pages look like existing thought pages, and save the screenshots in `qa/`
- [ ] 4.3 Use Claude Code computer use against the real Obsidian publisher with a throwaway `section: thought` note published to `nonprod`: screenshot the note appearing on `staging.justindfuller.com/thought` and its page, then screenshot the Obsidian notice shown for a throwaway `section: poem` note and verify it states the reason; then delete the throwaway notes and verify staging recovers; save the screenshots in `qa/`
- [ ] 4.4 Complete `qa.md` with the commit, timestamps, each check's outcome including failed attempts, and what the evidence does not prove (no production publish of a thought note), then copy its summary and screenshots into the PR description

## Workflow follow-up

- After the implementation PR merges and production deploys, publish one real thought note to `production` from Obsidian and verify with `curl` that it appears on the live `/thought` list, its page, and the sitemap.
- Do not add `section: thought` notes to the vault before the implementation has deployed, or the sync will reject them.
- Archive the change after review requirements are satisfied.
- Verify the archived specification contains the added and modified requirements.
