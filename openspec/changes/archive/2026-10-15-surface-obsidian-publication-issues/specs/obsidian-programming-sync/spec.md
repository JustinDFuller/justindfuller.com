## MODIFIED Requirements

### Requirement: Protected diagnostics and resource usage are observable

The system SHALL retain private diagnostics identifying synchronization status, file revisions, issues, route provenance, fallback state, and recovery separately for each target. Operators SHALL retrieve these reports through authenticated read-only tooling. Public Actions logs, summaries, artifacts, and comments SHALL contain sanitized counts, opaque revision identifiers, deployment identities, root deployment URLs, and safe failure categories only. They SHALL not include private filenames, nonprod/draft titles or slugs, unpublished post bodies, raw Markdown, secrets, or complete diagnostics. Rendered staging/PR archives and their detailed verification manifests SHALL remain privately stored and SHALL be transferred between jobs through authenticated checksummed storage; Cloudflare Access SHALL not be treated as protecting GitHub artifact downloads. Public artifacts SHALL contain only approved production assets and sanitized receipts. Actionable issues SHALL have durable deduplicated notification state; the Mac publisher SHALL display target-specific issues and recovery after reading the protected report, as the persistent issue notices requirement defines. Reports MAY retain a bounded plain-text reason for each issue and SHALL omit post bodies and credentials.

The system SHALL record publishing batch counts, per-target runner durations, build and deployment frequency, skips, retries, upload-to-verification latency, and relevant Cloudflare storage/operation/Worker usage, including additional staging work. GitHub Actions SHALL remain the selected service until a later reassessment. Included allowances SHALL not be described as spending caps, and unchanged scans SHALL not trigger scheduled rebuilds or per-preview fan-out.

#### Scenario: A private preview archive is passed to a deployment job

- **WHEN** staging or a PR build produces rendered nonprod HTML and verification data
- **THEN** the tested archive SHALL be retrieved privately and verified by checksum, and public workflow artifacts/logs SHALL contain no unpublished content or private paths

#### Scenario: The same invalid revision is retried

- **WHEN** later runs observe an unchanged issue
- **THEN** the protected report SHALL retain its fingerprint and the publisher SHALL not emit repeated notices for every scan

#### Scenario: An operator assesses build cost

- **WHEN** publishing has operated for a representative period
- **THEN** recorded run frequency, durations, latency, and provider usage SHALL support comparing GitHub Actions with Cloudflare Builds without changing content semantics

## ADDED Requirements

### Requirement: Publication issues stay visible in Obsidian until resolved

The Mac publisher SHALL keep a notice on screen for each unresolved blocking publication issue until the issue is resolved or dismissed. Each notice SHALL name the affected note, state a readable reason, and name the targets still serving the previous version. A status bar item SHALL show the number of unresolved issues and reopen their details. Dismissal SHALL last until the issue changes or recurs after recovery.

#### Scenario: An edit is rejected

- **WHEN** the protected report for any target contains a blocking issue for a note
- **THEN** the publisher SHALL show a notice that remains until resolved or dismissed, naming the note and the reason, and the status bar item SHALL count the issue

#### Scenario: The note is fixed

- **WHEN** a later protected report for the target contains no blocking issue for that note and its status is verified
- **THEN** the publisher SHALL clear the notice, update the status bar item, and report that publication recovered

#### Scenario: Several targets reject the same note

- **WHEN** staging and production both report issues for the same note
- **THEN** the publisher SHALL show one notice per distinct issue that names every affected target

#### Scenario: The person dismisses a notice

- **WHEN** a dismissed issue is still present in later reports with an unchanged fingerprint
- **THEN** the publisher SHALL NOT show the notice again until the issue changes or recurs after recovery

### Requirement: Public run output reports sanitized issue counts

Each hosted target run SHALL emit a warning annotation and a step summary line stating the target and the number of affected files by safe category. It SHALL NOT include filenames, titles, slugs, reasons, or other issue details. Runs without issues SHALL emit no warning.

#### Scenario: A run keeps one file at its previous version

- **WHEN** a staging run retains one file's last-known-good revision after a metadata failure
- **THEN** the run SHALL emit a warning annotation and summary line stating the target, the count, and the category, and no filename, title, slug, or reason

#### Scenario: A run has no issues

- **WHEN** every changed file validates
- **THEN** the run SHALL emit no issue warning

### Requirement: Rejected content concludes the run as failed without blocking valid publication

A staging or production target run SHALL conclude as failed when its preparation contains a blocking issue, after all valid content has been built, deployed, and verified. Blocking issues are Markdown validation failures, retained last-known-good fallbacks, route collisions, and overwrite-target conflicts. Image-not-ready issues SHALL warn without failing the run. Pull request checks SHALL NOT fail because of vault content.

#### Scenario: One note is invalid while another is valid

- **WHEN** one note is rejected and another note's valid change is in the same source revision
- **THEN** the valid note SHALL be published and verified and the run SHALL conclude as failed

#### Scenario: Every changed note is rejected

- **WHEN** the rejection leaves the effective content unchanged and the build is skipped
- **THEN** the run SHALL still conclude as failed

#### Scenario: A code push rebuilds from invalid source

- **WHEN** a push to the default branch triggers target runs while invalid vault content is present
- **THEN** each affected target run SHALL conclude as failed after publishing

#### Scenario: The invalid note is fixed

- **WHEN** a later run's preparation contains no blocking issue
- **THEN** the run SHALL conclude successfully

#### Scenario: An image is still uploading

- **WHEN** the only issue is an image that is not yet ready
- **THEN** the run SHALL warn and SHALL NOT conclude as failed
