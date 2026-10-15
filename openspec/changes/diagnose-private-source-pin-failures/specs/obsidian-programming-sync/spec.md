## ADDED Requirements

### Requirement: Private source pin failures state a safe cause

When the hosted private source pin step fails, it SHALL print a safe reason chosen from a fixed list identifying the stage that failed, in addition to its existing failure message. For a failing pin subprocess it SHALL also print the integer exit code and whether the process timed out or was signaled. The reason SHALL be assigned where the failure occurs and SHALL NOT be derived from error text. The output SHALL NOT include error messages, stack traces, bucket names, file paths, credentials, revisions or note identifiers. The step SHALL keep its failure exit status and its handling of an unavailable source.

#### Scenario: A pull request preview has no accepted target state

- **WHEN** the pin step finds no accepted state for the target and bootstrap is not requested
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
