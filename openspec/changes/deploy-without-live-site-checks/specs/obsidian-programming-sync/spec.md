## MODIFIED Requirements

### Requirement: Publication is verified and recoverable

The system SHALL build from a pinned code commit and complete source revision, generate the effective pages and sitemap together, and deploy the same artifact that passed validation. Publication records SHALL identify code commit, source revision, accepted-content digest, artifact checksum, workflow run, and deployment identity. Private fallback state SHALL advance only for a verified publication; unchanged effective content SHALL permit a verified no-deployment reconciliation. A build failure SHALL not deploy. A publication SHALL be considered successful when the Cloudflare deploy command succeeds and the Cloudflare API reports a single serving version at 100 percent that differs from the prior serving version. The release SHALL NOT make HTTP requests to the published website, including pages, assets, images, redirects, missing-page responses, a publication marker, or Access probes, to decide success, failure, or rollback. When Cloudflare reports a failed deployment, the system SHALL attempt to restore the prior deployment through the Cloudflare API and confirm through the API that it is serving. The integrity of retained artifacts SHALL still be checked against private storage. Ambiguous deployment or state promotion SHALL remain explicitly unverified until reconciled with the actual serving identity.

#### Scenario: Verification fails after upload

- **WHEN** the deploy command fails or the Cloudflare API does not show the candidate serving at 100 percent
- **THEN** the system SHALL attempt rollback through the Cloudflare API, record whether rollback was verified, and SHALL not mark the candidate accepted

#### Scenario: Bot Fight Mode blocks automated requests from CI

- **WHEN** the zone blocks automated requests from the release runners and Cloudflare reports a tested artifact deployed
- **THEN** the system SHALL accept the publication without making any request to the website

#### Scenario: A deployment response is lost

- **WHEN** a production or staging deployment response is lost and the serving version's recorded message equals the candidate's artifact checksum
- **THEN** the system SHALL treat the serving version as its own candidate and roll it back, and SHALL require operator reconciliation for any other serving version

### Requirement: Persistent staging and previews require owner authentication

Production and persistent staging SHALL update automatically from main and applicable source revisions. Staging SHALL remain available at `staging.justindfuller.com` without a running local server or open PR. PR previews SHALL include the applicable source snapshot during existing build events and an explicit manual refresh of an open same-repository PR. Vault edits SHALL not automatically rebuild every preview. Preview builds SHALL remain noindex and SHALL never alter production state.

Cloudflare Access SHALL protect the entire staging Worker and all production-Worker PR preview destinations, including every enabled custom domain, workers.dev URL, alias, and immutable preview URL. Human access SHALL be restricted to the explicitly configured owner's identity; CI verification SHALL use a separate Service Auth policy and protected service token. Anonymous, disallowed, and invalid-token requests SHALL reveal no private HTML, asset, sitemap/feed data, or image bytes. Protection SHALL be verified through the Cloudflare Access API, confirming the application, policies, destinations, and service token, before any nonprod deployment; the release SHALL NOT verify protection by requesting the protected site. Absent or unverifiable required protection SHALL block private deployment. Authenticated staging/PR responses SHALL use private no-store caching, and denied requests after authorized requests SHALL remain denied. Production SHALL remain public and preserve its existing caching behavior.

Fork and Dependabot validation SHALL remain credential-free and SHALL use Git content and fixtures. Local development SHALL support explicit source preparation and Git-only operation, with preview and private-image listeners bound to loopback.

#### Scenario: The owner previews without a PR or local server

- **WHEN** a valid nonprod post has been successfully reconciled and no PR or local server is running
- **THEN** the owner SHALL be able to authenticate to persistent staging and preview the post and its images

#### Scenario: A private preview URL is shared

- **WHEN** an unauthenticated or disallowed client requests staging, a PR alias, an immutable preview URL, or a private image path
- **THEN** Access SHALL withhold private response bodies even after authorized requests to the same resources

#### Scenario: Access protection is missing

- **WHEN** a build cannot verify the required Access protection for a private destination
- **THEN** it SHALL not deploy private content to that destination and SHALL report an actionable private deployment failure

#### Scenario: A fork PR is built

- **WHEN** a preview or validation run belongs to a fork or Dependabot
- **THEN** it SHALL receive no R2 source, state, or deployment credentials and SHALL validate using Git-backed content and fixtures

## ADDED Requirements

### Requirement: An uploaded staging version is identified through the Cloudflare API

After uploading a staging Worker version, the system SHALL identify it by asking the Cloudflare API for the Worker version whose message equals the candidate's artifact checksum, using the newest match, and SHALL NOT depend on the text printed by the deploy command. If no such version exists, the system SHALL fail before switching staging traffic.

#### Scenario: The deploy command output changes

- **WHEN** the deploy command prints its version information on a different stream or in a different format
- **THEN** the system SHALL still switch staging to the uploaded version

#### Scenario: No uploaded version carries the artifact checksum

- **WHEN** the Cloudflare API lists no version whose message equals the candidate's artifact checksum
- **THEN** the system SHALL fail without changing staging traffic
