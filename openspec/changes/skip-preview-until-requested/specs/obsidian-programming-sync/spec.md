## MODIFIED Requirements

### Requirement: Private source pin failures state a safe cause

When the hosted private source pin step fails, it SHALL print a safe reason chosen from a fixed list identifying the stage that failed, in addition to its existing failure message. For a failing pin subprocess it SHALL also print the integer exit code and whether the process timed out or was signaled. The reason SHALL be assigned where the failure occurs and SHALL NOT be derived from error text. The output SHALL NOT include error messages, stack traces, bucket names, file paths, credentials, revisions or note identifiers. The step SHALL keep its failure exit status and its handling of an unavailable source. The only absence of accepted state that SHALL NOT fail the step is the one defined by the requirement that a pull request without a preview yet is not a failure.

#### Scenario: A pull request preview has no accepted target state

- **WHEN** the pin step finds no accepted state for the target, bootstrap is not requested, and the run is not a pull request event for a preview (for example a manual refresh, production or staging)
- **THEN** the step SHALL fail, print its existing failure message and the reason `accepted_state_unavailable`, and print no storage or path details

#### Scenario: The pin binary fails

- **WHEN** the pin subprocess exits with an error other than the unavailable-source code
- **THEN** the step SHALL print the reason `source_pin_failed` with the integer exit code and the timed-out and signaled flags, and SHALL NOT print the subprocess output

#### Scenario: An error message contains private text

- **WHEN** an underlying error message includes a bucket name, key or path
- **THEN** the public output SHALL contain none of that text and SHALL carry only a reason from the fixed list, or `unknown`

#### Scenario: The source is unavailable

- **WHEN** the pin subprocess exits with the unavailable-source code
- **THEN** the step SHALL behave as it does today and SHALL NOT report a failure

## ADDED Requirements

### Requirement: A pull request without a preview yet is not a failure

When a pull request event reaches the private preview job and the pull request's preview has no accepted state, and bootstrap is not requested, the preparation job SHALL succeed, print a fixed notice that no preview exists yet and how to create one, and the build and deploy jobs SHALL be skipped. This SHALL apply only to the preview mode on a pull request event and only when the stored object is absent. A pull request preview that already has accepted state SHALL be refreshed as before.

#### Scenario: A new pull request has no preview

- **WHEN** a pull request event runs the private preview job for a pull request that has never had a preview, without bootstrap
- **THEN** the preparation job SHALL succeed with a notice, and the build and deploy jobs SHALL be skipped, and the notice SHALL contain no storage names, paths, revisions or note identifiers

#### Scenario: A pull request already has a preview

- **WHEN** a pull request event runs the private preview job for a pull request with accepted preview state
- **THEN** the job SHALL proceed to prepare, build and deploy exactly as before

#### Scenario: A manual refresh finds no preview

- **WHEN** someone runs the workflow manually to refresh a pull request preview that has no accepted state and does not request bootstrap
- **THEN** the pin step SHALL fail with the reason `accepted_state_unavailable`

#### Scenario: The state store cannot be read or holds unusable state

- **WHEN** a pull request event cannot read the state store, or the stored state is unparseable or incompatible
- **THEN** the pin step SHALL fail with `state_store_unreachable`, `accepted_state_invalid` or `accepted_state_incompatible` as it does today

#### Scenario: Production or staging has no accepted state

- **WHEN** the production or staging pin step finds no accepted state and bootstrap is not requested
- **THEN** the pin step SHALL fail with `accepted_state_unavailable`
