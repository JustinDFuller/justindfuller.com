# Proposal

## Why

Every pull request run that reaches the private preview job fails at the step "Pin the current private source with trusted main code". In the 25 most recent pull request runs, going back to 16 October, 13 reached that job, all 13 failed at it, and every build and deploy job after it was skipped. No pull request has ever received an automatic private preview.

The cause is a rule meant for production and staging. Those are single targets, so their first deployment needs an explicit, deliberately approved bootstrap. The same rule was applied to previews, but every pull request is a new preview target with no accepted state yet, and a pull request run has no way to request bootstrap. The check is therefore guaranteed to fail the first time it runs for any pull request, and it says nothing about the pull request itself.

## What Changes

- When a pull request run finds that its preview has no accepted state yet and bootstrap is not requested, the preparation job succeeds. It prints a notice that no preview exists yet and how to create one, and the build and deploy jobs are skipped.
- Once a preview exists, later pull request events refresh it exactly as they do today.
- Every other missing or unusable state still fails loudly with its current reason: a manual refresh with no state, a missing production or staging state, an unreachable store, and invalid or incompatible state.
- Not in this change: creating previews automatically for new pull requests, the production and staging bootstrap rules, and what a preview deployment does.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `obsidian-programming-sync`: the requirement for private source pin failures is modified, and a requirement for pull requests without a preview is added.

## Impact

- Scripts: `scripts/pin-obsidian-workflow-source.mjs` and its tests.
- Workflow: `.github/workflows/obsidian-target.yml` passes the new option for pull request preview runs and skips the prepare step when no preview exists.
- Docs: `docs/obsidian-cloudflare.md`.
- Trade-off: a pull request gets a private preview only after someone asks for one with a manual refresh and bootstrap. A pull request check can now pass without proving anything about a preview, which is accurate because there is no preview to prove.
