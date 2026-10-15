# Tasks

## 1. Reasons in the pin script

- [x] 1.1 Add a failure type with a closed list of reasons to `scripts/pin-obsidian-workflow-source.mjs`, assign a reason at each failure point, and print the existing message plus one JSON line with the reason; verify in `scripts/pin-obsidian-workflow-source.test.mjs` that each failure point yields its reason and that an unclassified error yields `unknown`
- [x] 1.2 Add the exit code, timed-out and signaled fields for `source_pin_failed` and keep exit code 10 as an unavailable source; verify with a test for both outcomes
- [x] 1.3 Verify with a canary test that error text containing a bucket name, key and path never appears in the output

## 2. Proof

- [ ] 2.1 After the change is merged to the default branch, re-run the `private-preview / prepare` job on an open pull request, read the reason from the public log, and record it in `qa.md` with the run ID

## Workflow follow-up

- Archive the change after review requirements are satisfied.
