# QA

This file records the proof for tasks 5.1 to 5.3. It is incomplete: the end-to-end checks have not been run, and the reasons are below.

## What was verified

- Automated checks on the implementation branch pass locally: 229 tests (226 pass, 3 are skipped because they need Linux), the plugin type check, Prettier, and Markdown lint. `openspec validate surface-obsidian-publication-issues` reports the change as valid.
- Pull request checks on the implementation PR are green except the `private-preview / prepare` job of the `pull_request_target` run, which fails at "Pin the current private source with trusted main code". That job fails the same way on the docs-only proposal PR, so it does not come from this change.
- Three fresh-context adversarial reviews and one scope check were run. Their findings were fixed or are listed in the PR description.

## What is not yet proven

- Task 5.1: a throwaway note with an invalid `environment` beside a valid edit, a red staging run that still deploys the valid edit, a public summary with only counts and categories, and the persistent notice and status bar item in the real Obsidian app.
- Task 5.2: the fixed note, a green run, the notice clearing with "publication recovered", and public logs free of the note's filename, slug and reason.
- Task 5.3: commit, run IDs, timestamps and screenshots.

## Why the end-to-end checks are blocked

- The vault is in iCloud Drive, and the agent identity is denied access to it by macOS. This is treated as intentional scoping, so no throwaway note was created.
- The publisher reads its protected reports from private Cloudflare R2 storage using the account's credentials in the Keychain. The agent identity does not hold them, and the endpoint cannot be redirected locally.
- Staging and production runs execute the workflow from the default branch, which does not contain the new final job until the implementation is merged.
