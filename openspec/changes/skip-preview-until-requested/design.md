# Design

## Context

The pin step reads `accepted/<namespace>/current.json` from the private state bucket. A missing object is reported as `accepted_state_unavailable` unless `--bootstrap` is passed. Bootstrap comes only from the manual workflow form, so a pull request run can never pass it.

## Decisions

### A separate, explicit option, limited to pull request preview runs

The pin script gains `--skip-if-missing`. The workflow passes it only when the target mode is `preview` and the triggering event is `pull_request_target`. The script refuses the option for any other mode with the existing `invalid_target` reason.

Alternative considered: skip whenever state is missing. Rejected because a missing production or staging state, or a missing state on a manual refresh someone asked for, is a real problem that must stay loud.

### Only a truly missing object is neutral

The storage layer already separates a missing object (returns nothing) from a failed read (throws, reported as `state_store_unreachable`). Only the missing case becomes neutral. Unparseable and incompatible state keep their reasons.

### Reuse the existing skip path

On a missing preview the pin step writes `no_preview=true` to the job output and prints a notice, then exits successfully. The prepare step is skipped when that output is true. The job's `decision` output stays empty, so the build and deploy jobs, which require `decision == 'build-required'`, are skipped, and the conclude job, which requires a blocking count, is skipped too.

### Notice wording

The notice is fixed text with no storage names, paths or revisions: "No private preview exists for this pull request yet. Run the workflow manually with publish kind preview, this pull request number and bootstrap to create one."

## Risks / Trade-offs

- A pull request that never gets a preview shows a passing check with skipped jobs. The notice explains why.
- The workflow change runs from the default branch for pull request events, so its effect can only be proven after merge by looking at a later pull request run.
