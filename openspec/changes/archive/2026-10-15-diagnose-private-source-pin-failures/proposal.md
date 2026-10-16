# Proposal

## Why

The `private-preview / prepare` check fails on pull requests with the single line "Trusted private source pin failed". The pin script (`scripts/pin-obsidian-workflow-source.mjs`) has about ten distinct ways to fail, such as a missing accepted target state, an incompatible one, an unreachable state bucket, a failing pin binary or an invalid pinned source, and it collapses all of them into that line. The check has been failing on unrelated pull requests since early October, including Dependabot updates, and nobody can tell from the log whether the cause is missing state, expired credentials or a broken binary. The sibling preparation script already prints a safe structured failure summary, so this script is the outlier.

## What Changes

- The pin script reports a safe failure reason from a fixed list alongside its existing message. The reason is chosen from where the failure happened, never from the text of an error.
- For a failing pin binary, the report also carries the integer exit code, whether it timed out, and whether it was signaled, matching the fields the preparation script already prints.
- The existing message, exit status and the `source_unavailable` handling for exit code 10 stay as they are.
- Not in this change: fixing the underlying failure, seeding accepted state for new pull request previews, changing secrets, or loosening any trust gate in the workflow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `obsidian-programming-sync`: one requirement is added stating that private source pin failures name a safe cause in public logs.

## Impact

- Scripts: `scripts/pin-obsidian-workflow-source.mjs` and a new `scripts/pin-obsidian-workflow-source.test.mjs`.
- Workflow: no change.
- Privacy: the added output is a fixed reason string and integers. No error text, paths, bucket names, keys or revisions are printed.
- Timing: pull request runs execute the workflow and scripts from the default branch, so the reason appears on pull request checks only after this change is merged.
