## 1. Pin step

- [x] 1.1 Add the `--skip-if-missing` option to the pin script: neutral result with `no_preview=true` and a fixed notice when preview state is missing, bootstrap is not requested and the option is passed; `invalid_target` when passed for another mode.
- [x] 1.2 Tests for every scenario in the delta spec, including that a failed read, invalid state and incompatible state still fail with their reasons.

## 2. Workflow and docs

- [x] 2.1 Pass the option for pull request preview runs and skip the prepare step when `no_preview` is true.
- [x] 2.2 Update `docs/obsidian-cloudflare.md`.
- [x] 2.3 `openspec validate skip-preview-until-requested`, tests, formatting and lint.

## 3. Proof

- [ ] 3.1 After merge, read a later pull request run: the preview prepare job passes with the notice and build and deploy are skipped. Capture screenshots and record them in `qa.md`.
- [ ] 3.2 Show that a manual preview refresh without state still fails with `accepted_state_unavailable`, if a safe way exists, and record what was not proven.
