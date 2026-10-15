# Design

## Context

See proposal.md for motivation. The pin step runs from trusted default-branch code with private storage credentials and must keep public output limited to counts, opaque identifiers and safe categories. Today every failure inside `pinWorkflowSource` ends in the same fixed line, so a maintainer cannot tell a missing accepted state from a credential or binary problem.

## Goals / Non-Goals

**Goals:**

- Make each pin failure name where it happened, using only values the script controls.
- Follow the pattern the preparation script already uses for its structured failure summary.

**Non-Goals:**

- Fixing the failure that triggered this work, or changing what the pin step accepts.
- Printing error messages, stack traces, bucket names, paths, keys or revisions.
- Changing the workflow file.

## Decisions

### A fixed list of reasons, assigned at the throw site

Each failure point throws a small error type that carries one reason from a closed list: `invalid_target`, `state_store_unreachable`, `accepted_state_unavailable`, `accepted_state_invalid`, `accepted_state_incompatible`, `source_pin_failed`, `pinned_source_unreadable` and `pinned_source_invalid`. Anything that does not carry a reason is reported as `unknown`. The reason is never derived from an error message, so a message that contains a secret or private name cannot leak.

Alternative considered: classify by matching error text, as the subprocess helper does for stderr. Rejected because the pin step handles private storage errors, and text matching risks echoing or misclassifying them.

### Subprocess details limited to integers and flags

For `source_pin_failed` the report adds the exit code as an integer, `timedOut` and `signaled` as booleans. Exit code 10 keeps its current meaning of an unavailable source and is not a failure.

### Output shape

The existing line "Trusted private source pin failed" stays, followed by one JSON line such as `{"reason":"accepted_state_unavailable"}`. The exit status stays 1.

## Risks / Trade-offs

- A reason names the failing stage, which is slightly more than the current output. It reveals no private identifier, and the list is fixed in code and spec.
- Pull request runs use the default branch's copy, so the benefit begins after merge. Mitigation: the proof task re-runs a pull request check after merge and reads the reason.

## Migration Plan

Merge normally. There is no data or workflow change to migrate.

## Open Questions

None.
