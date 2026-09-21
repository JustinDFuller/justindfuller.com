# Obsidian Programming Sync QA

## 1. Tests to run to verify the spec

Status values used below:

- `PASS`: the exact scenario was exercised by an automated test or manual smoke test.
- `PARTIAL`: related coverage exists, but the exact scenario still needs a dedicated test or environment.
- `NOT RUN`: the test requires production deployment, an alerting destination, or an external mutation that was intentionally not performed.

### Source layout

- [ ] `QA-01` A supported root Markdown file is discovered.
- [ ] `QA-02` A supported nested image below `image/` is discovered.
- [ ] `QA-03` An unsupported file or directory is reported and isolated from valid files.

### Markdown metadata

- [ ] `QA-04` Complete supported programming metadata produces a valid candidate.
- [ ] `QA-05` Missing, malformed, unknown, or unsupported metadata invalidates only that Markdown revision.
- [ ] `QA-06` Missing, empty, or malformed tags invalidates only that Markdown revision.

### Environment targeting

- [ ] `QA-07` A `prd` file is eligible in production, previews, and local development.
- [ ] `QA-08` A `pr` file is eligible in previews and local development, but not production.
- [ ] `QA-09` A `local` file is eligible only in local development.
- [ ] `QA-10` Preview or local authentication failure preserves Git-backed content and exposes the failure.

### Additive and overwrite merging

- [ ] `QA-11` A valid additive entry is served at its new route.
- [ ] `QA-12` A valid overwrite entry replaces exactly one local route while retaining the local fallback.
- [ ] `QA-13` An additive collision leaves the local route unchanged and reports the collision.
- [ ] `QA-14` A missing or ambiguous overwrite target is rejected without affecting other routes.

### Draft behavior

- [ ] `QA-15` A draft additive entry is excluded from public lists, routes, and the sitemap.
- [ ] `QA-16` A draft overwrite masks its local route rather than exposing the local post.

### Image synchronization

- [ ] `QA-17` A valid nested `.jpg`, `.png`, or `.svg` image is served through the synchronized post.
- [ ] `QA-18` A missing, unreadable, or invalid image is omitted while the post remains available.
- [ ] `QA-19` An image reference outside the synchronized source is omitted and reported.
- [ ] `QA-20` An unsupported image format is omitted and reported without invalidating the post.

### File-level isolation

- [ ] `QA-21` An invalid Markdown post does not affect a valid post or its valid image.
- [ ] `QA-22` An invalid image does not affect its valid Markdown post or unrelated content.
- [ ] `QA-23` Multiple independent file errors remain isolated from one another and from valid content.

### Closed Markdown validation set

- [ ] `QA-24` A file satisfying exactly the specified Markdown validation set is accepted.
- [ ] `QA-25` Malformed or unsupported Markdown content is rejected according to the specified rules.
- [ ] `QA-26` A valid file revision remains usable while another file is invalid.
- [ ] `QA-27` Content conditions outside the validation set are not rejected by undocumented heuristics.

### Invalid-file and source failure behavior

- [ ] `QA-28` A never-before-published invalid file is omitted without affecting valid content.
- [ ] `QA-29` A previously published file that becomes invalid retains its last-known-good revision.
- [ ] `QA-30` A source outage after successful synchronization retains the last-known-good external overlay.

### Production graceful degradation

- [ ] `QA-31` A temporary first production synchronization failure leaves Git-backed pages and the local sitemap available.
- [ ] `QA-32` An initial production credential, configuration, or authorization failure leaves Git-backed pages available and avoids a tight retry loop.
- [ ] `QA-33` A temporary production source failure recovers and clears the active failure after reconciliation.
- [ ] `QA-34` A corrected production credential or authorization failure resumes synchronization and emits recovery information.
- [ ] `QA-35` A later production source failure preserves the last-known-good external state and marks it stale.
- [ ] `QA-36` An unavailable production image is omitted without failing the post, programming collection, or sitemap.

### Authentication

- [ ] `QA-37` Local synchronization uses the macOS Keychain authorized-user OAuth credential.
- [ ] `QA-38` Missing, malformed, or service-account local credentials produce a configuration issue without falling back to a credential file.
- [ ] `QA-39` Preview and production use hosted ADC and do not invoke the local Keychain reader.

### Deletion behavior

- [ ] `QA-40` Deleting an additive Drive file removes only the external route and does not change Git content.
- [ ] `QA-41` Deleting an overwrite Drive file restores the matching local route and does not change Git content.

### Observability

- [ ] `QA-42` Protected diagnostics identify local, additive Obsidian, and Obsidian-overwrite route provenance.
- [ ] `QA-43` Invalid files expose file identity, revision, category, actionable message, route, and fallback state.
- [ ] `QA-44` Correcting an invalid file publishes the valid revision and emits recovery information.

### Notifications

- [ ] `QA-45` A new invalid-file or source-wide issue produces an administrator-notifiable signal.
- [ ] `QA-46` Reobserving the same issue does not produce an unbounded duplicate notification.
- [ ] `QA-47` Correcting an issue resolves it and produces recovery information.

### Sitemap

- [ ] `QA-48` A valid, published external programming route appears in the sitemap.
- [ ] `QA-49` Draft, invalid, environment-ineligible, and unsupported files do not appear in the sitemap.
- [ ] `QA-50` Removing an external entry updates the sitemap without removing unrelated local URLs.

### Homepage and source safety

- [ ] `QA-51` Synchronized posts do not modify the dynamic homepage feature-post collection.
- [ ] `QA-52` Synchronization performs no Drive or repository mutation.
- [ ] `QA-53` A collision or invalid file changes only runtime overlay state and does not mutate Git or Drive.

## 2. What was done for each test and the results

Test date: 2026-09-20.

The automated tests were run against the working tree at commit `28d33ba` on branch `codex/obsidian-programming-sync-final`. No credentials or token values are recorded here.

### Automated validation

Commands run:

```sh
GOCACHE=/private/tmp/justindfuller-go-cache go test ./...
GOCACHE=/private/tmp/justindfuller-go-cache go test -race ./...
GOCACHE=/private/tmp/justindfuller-go-cache go vet ./...
openspec validate --changes --strict --no-interactive
git diff --check
```

Results:

- `go test ./...`: `PASS`; all packages passed, including `obsidian`.
- `go test -race ./...`: `PASS`; the `obsidian` package passed under the race detector.
- `go vet ./...`: `PASS`.
- OpenSpec strict validation: `PASS`; one change validated successfully.
- `git diff --check`: `PASS`; no whitespace errors.

The first `go test ./...` attempt used the default macOS Go build cache and was blocked by the sandbox from reading that cache. Repeating the same test with the task-local `GOCACHE` above passed; this was a test-environment issue, not a product failure.

Automated scenario results:

| Tests | What was run | Result |
| --- | --- | --- |
| `QA-01`, `QA-02` | `TestStoreAddsValidEntryAndRewritesImage` with root Markdown and a nested PNG image | `PASS` |
| `QA-03`, `QA-20` | `TestUnsupportedImageIsolatedFromPost` and `TestUnsupportedRootLayoutIsolatedFromValidPost` | `PASS` |
| `QA-04` | Valid metadata through `TestStoreAddsValidEntryAndRewritesImage` | `PASS` |
| `QA-05`, `QA-06` | `TestInvalidMarkdownDoesNotBlockValidPost`, `TestMetadataRejectsUnknownKeysAndMalformedTags`, and `TestInvalidMetadataRevisionsDoNotBlockValidPost` | `PASS` |
| `QA-07`, `QA-08`, `QA-09` | `TestEnvironmentPromotionMatrix` | `PASS` |
| `QA-10` | Malformed/service-account credential rejection tests; source-failure fallback tests | `PARTIAL`: unit behavior is covered, but a live preview/local authentication outage was not induced |
| `QA-11` | `TestStoreAddsValidEntryAndRewritesImage` | `PASS` |
| `QA-12`, `QA-16`, `QA-41` | `TestOverwriteAndDraftMaskLocalRoute` | `PASS` |
| `QA-13` | `TestRouteCollisionRetainsPreviousOwner` | `PASS` |
| `QA-14` | `TestUnpublishableRevisionRetainsLastKnownGoodPost` | `PASS` |
| `QA-15` | `TestLocalDraftRouteIsNotResolved` and `TestDraftAdditiveEntryIsExcludedFromRoutesAndSitemap` | `PASS` |
| `QA-17` | `TestSupportedJPEGAndSVGImagesAreServed`, `TestMarkdownImageDestinationWithTitleIsServed`, `TestMarkdownImageDestinationWithParenthesesIsServed`, and `TestMarkdownImageDestinationWithEscapedParenthesesIsServed` | `PASS`; MIME types and standard Markdown destination/title/parenthesis/escape syntax were asserted |
| `QA-18` | `TestInvalidImageOnlyOmitsImage`, `TestInvalidImageBytesOnlyOmitImage`, and the 503 download case | `PASS`; an image-specific 503 remains an `image_download` issue, omits only that image, and keeps the post available |
| `QA-19` | `TestRawHTMLImageIsOmittedWithoutBlockingPost` and `TestMultilineRawHTMLImageIsOmitted` | `PASS` for outside-source raw HTML images, including multiline tags |
| `QA-21` | `TestIndependentErrorsDoNotBlockValidContent` | `PASS`; an invalid Markdown file does not affect a valid post or its valid image |
| `QA-22` | Invalid image download and invalid image bytes tests | `PASS` |
| `QA-23` | `TestIndependentErrorsDoNotBlockValidContent` | `PASS`; independent Markdown metadata and image-validation failures are both reported while valid content publishes |
| `QA-24`, `QA-25`, `QA-27` | Valid rendering, malformed and malformed-angle image syntax, Markdown image titles and balanced/escaped destinations, multiline raw HTML images, fenced/indented/inline/multiline-inline code preservation, outside-source images, metadata escaping, and executable-content tests | `PASS` for the implemented validation cases |
| `QA-26` | `TestInvalidMetadataRevisionsDoNotBlockValidPost`, `TestIndependentErrorsDoNotBlockValidContent`, and last-known-good revision tests | `PASS` for valid-content isolation during invalid revisions |
| `QA-28` | `TestInvalidMarkdownDoesNotBlockValidPost` | `PASS` |
| `QA-29` | `TestInvalidLayoutRevisionRetainsLastKnownGoodPost` and `TestUnpublishableRevisionRetainsLastKnownGoodPost` | `PASS` |
| `QA-30`, `QA-35` | `TestSourceFailureRetainsLastKnownGoodAndMarksStale` and `TestMarkdownDownloadSourceFailureRetainsLastKnownGood` with generic transport failure, plus typed EOF classification | `PASS` for fallback/stale state and generic/typed transport classification; production deployment was not used |
| `QA-31`, `QA-32`, `QA-33`, `QA-34`, `QA-36` | Production nonblocking, source-initialization nonblocking, failure classification, fallback, and image-isolation unit coverage | `PARTIAL`: production-specific failure/recovery drills remain outstanding |
| `QA-37` | Keychain credential unit test plus live local Keychain-backed synchronization | `PASS` |
| `QA-38` | Malformed and service-account credential unit tests | `PARTIAL`: missing-item behavior was not induced live |
| `QA-39` | Successful hosted PR preview synchronization | `PASS` |
| `QA-40`, `QA-50` | `TestSynchronizationEventsAreDeduplicatedAndDeletionIsObservable`, `TestAdditiveDeletionRemovesRouteAndPreservesLocalSitemapEntries`, and overwrite restoration sitemap assertions | `PASS` |
| `QA-42`, `QA-43` | Diagnostics model tests and live protected diagnostics checks | `PASS` |
| `QA-44` | `TestCorrectedFileEmitsRecoveryEventWithoutDuplicateNotifications` | `PASS` for valid revision publication and recovery event; external alert delivery remains untested |
| `QA-45`, `QA-46` | Event/issue deduplication behavior | `PARTIAL`: structured log signals are covered, but no external alert destination is configured or tested |
| `QA-47` | `TestCorrectedFileEmitsRecoveryEventWithoutDuplicateNotifications` | `PARTIAL`: recovery event and notification deduplication are tested, but no external alert destination is configured |
| `QA-48`, `QA-49` | `TestBuildSitemapPreservesBaseAndAddsProgrammingEntries`, draft/environment tests, `TestDraftAdditiveEntryIsExcludedFromRoutesAndSitemap`, and live sitemap checks | `PASS` for valid-route inclusion and current exclusions |
| `QA-51` | Unknown metadata rejection prevents unsupported feature behavior | `PARTIAL`: no dedicated homepage snapshot comparison was run |
| `QA-52`, `QA-53` | Read-only source interfaces, collision tests, invalid-file tests, and code review | `PARTIAL`: no external mutation audit can be proven by a runtime smoke test |

The hardening passes added regression coverage for unsupported root layout items, metadata isolation, JPEG/SVG assets, draft additive entries, code-sample preservation, HTML-safe external metadata, Markdown download source failures, configured non-production timeouts, callback reentrancy, additive deletion/sitemap reconciliation, corrected-file recovery, image-specific 503 isolation, OAuth token-endpoint 5xx classification, standard Markdown image titles and balanced/escaped destinations, malformed angle destinations, multiline raw HTML image removal, independent file-error isolation, images in fenced and multiline inline code, generic transport recovery, and source-initialization request isolation.

### Local manual smoke test

The local server was started with the Keychain-backed OAuth credential and the configured Drive folder. The credential was read from the existing macOS Keychain item; its value was never printed. This smoke test was rerun against commit `28d33ba` after the parser, source-initialization, dynamic-cache, and transport-classification hardening.

Steps:

1. Start the local server with `OBSIDIAN_ENVIRONMENT=local`, the configured Drive folder ID, and `OBSIDIAN_DIAGNOSTICS_TOKEN="$(security find-generic-password -a "$USER" -s "justindfuller.com/obsidian-diagnostics-token" -w)"`; the application receives the token through its environment configuration.
2. Request `/programming/obsidian-local-keychain-test`.
3. Extract the generated `/__obsidian/image/<token>` reference from the HTML.
4. Request that image URL.
5. Request `/sitemap.xml`.
6. Request `/__obsidian/diagnostics` with the Keychain diagnostics token.
7. Request `/__obsidian/diagnostics` without authorization.
8. Compare the synchronized image hash with the repository source image.

Observed results:

- Post response: HTTP `200`.
- Sitemap response: HTTP `200`.
- Image reference: present in the rendered post.
- Image response: HTTP `200`, MIME type `image/png`, `4762` bytes.
- Image SHA-256: `6f60d49a6d4e4f3b808d2ceb123499fb6fe2ff45f1c7deaf20cc833d1a6dfaf0`.
- Sitemap: contained `obsidian-local-keychain-test`.
- Dynamic programming and sitemap responses returned `Cache-Control: no-store`; synchronized image responses retained the content-addressed long-cache policy.
- Unknown post response: HTTP `404` with `Cache-Control: no-store`.
- Unknown synchronized image response: HTTP `404` with `Cache-Control: no-store`.
- Authorized diagnostics: HTTP `200`; route provenance was `{source: "obsidian", mode: "add"}`.
- Unauthorized diagnostics: HTTP `404`.
- Diagnostics reported `Test.md` as valid and `Test-NonProd.md` as invalid with a `markdown_metadata` issue.
- The invalid test file did not prevent the valid synchronized post, image, or sitemap from being served.
- The local synchronized image hash matched `image/rain.png` in the repository.

Local manual results: `PASS` for `QA-37`, `QA-42`, `QA-43`, `QA-48`, and the valid-content portions of `QA-01`, `QA-02`, `QA-11`, `QA-17`, `QA-21`, and `QA-23`.

### PR preview manual smoke test

Steps:

1. Request the synchronized post route on `https://pr-390-dot-justindfuller.uc.r.appspot.com`.
2. Request the preview sitemap.
3. Extract and request the synchronized image URL.
4. Compare the preview image hash with the local and repository hashes.
5. Request diagnostics with the protected token.
6. Request diagnostics without authorization.

Observed results:

- Post response: HTTP `200`.
- Sitemap response: HTTP `200` and contained `obsidian-local-keychain-test`.
- Image response: HTTP `200`, MIME type `image/png`, `4762` bytes.
- Preview image SHA-256 matched both the local response and repository source image.
- Authorized diagnostics: HTTP `200`; the route was reported as Obsidian additive content.
- Unauthorized diagnostics: HTTP `404`.
- The same invalid `Test-NonProd.md` issue was reported without preventing the valid route from serving.

PR preview manual results: `PASS` for `QA-39`, `QA-42`, `QA-43`, `QA-48`, and the valid-content portions of `QA-01`, `QA-02`, `QA-11`, and `QA-17`.

### Remaining QA gates

The following are intentionally recorded as incomplete rather than treated as passed:

- No production deployment or production `environment: prd` content smoke test has been run.
- No live source outage, missing production credential, denied folder access, or recovery drill has been run.
- No actual Cloud Logging/Monitoring notification destination has been configured or tested.
- No destructive Drive deletion test has been run against the configured source.
- A dedicated homepage feature-post noninterference comparison remains outstanding.
