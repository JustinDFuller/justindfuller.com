# QA

## Task 2.1: the real failure reason

After the change was merged to the default branch (commit `243d7f7`), the `private-preview / prepare` job was run again on an open pull request whose head was rebased onto that commit. The first attempt was a re-run of an older job, which reused the old script and printed no reason, so a fresh run was needed to pick up the merged script.

- Run: 38764851731, a `pull_request_target` run on 2026-10-15 for the open pull request that surfaces Obsidian publication issues.
- The public log of the "Pin the current private source with trusted main code" step now reads `Trusted private source pin failed` followed by `{"reason":"accepted_state_unavailable"}`.
- The log contains no bucket names, keys, paths, revisions or note identifiers.

## What this means

The pin step found no accepted state for the pull request's preview target, and bootstrap is only requested explicitly through a manual workflow run. A pull request preview that has never been initialized therefore fails this job by design. This matches the earlier failures on documentation-only and dependency pull requests. It is not caused by the changes in those pull requests.

## What was not done

Initializing the preview target uses the explicit bootstrap path of the workflow, which is a deliberate gate. It was not run, so the red check on those pull requests remains.
