# Proposal

## Why

Every release since 24 October has failed at "Deploy the exact private tested handoff", for both staging and production. There were two independent causes.

First, the release crawls the live website from GitHub's runners before and after each deployment: every page, asset, image, redirect, 404, the publication marker, and "Access turns a stranger away" probes. Bot Fight Mode was turned on for the zone on 24 October and answers those runner requests with a 403. The crawler retries every URL seven times and runs into the 15-minute limit, and the deploy step hides the real error. The owner wants Bot Fight Mode to stay on, and wants the release to trust Cloudflare's own deploy result instead of probing the site.

Second, staging reads the new version ID from the output of `cf workers versions create`. The `cf` command-line tool moved that output from stdout to stderr in beta.21, and a Dependabot update brought in beta.23 on 27 October. Staging uploads the version and then cannot find its ID, so it never switches traffic to it. This failure was hidden behind the first one until Bot Fight Mode was turned off and a fresh run reached the staging deploy.

## What Changes

- The release makes no HTTP requests to the published website to decide success, failure or rollback. This removes the live crawler, the publication marker fetch and the Access denial probes from the release path.
- A publication succeeds when the deploy command succeeds and the Cloudflare API reports a single serving version at 100 percent that differs from the prior one.
- When Cloudflare reports a failed deploy, the release restores the prior version through the Cloudflare API and confirms through the API that it is serving.
- Access protection for staging and previews is still verified before deployment, but through the Cloudflare Access API rather than by requesting the site.
- A lost deployment response is correlated to its candidate through the artifact checksum that Cloudflare records as the version message, not through the marker served by the site. Native previews record no such message and fall back to operator reconciliation.
- Staging identifies its uploaded version by asking the Cloudflare API for the version whose message is the artifact checksum, not by parsing command output.
- The legacy workflow's two live verification steps and the crawler script are deleted.
- Not in this change: turning Bot Fight Mode on or off, fixing the rejected note that keeps the run red, a safe failure summary for the deploy step, and making a re-run of failed jobs work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `obsidian-programming-sync`: two requirements are modified (publication verification and recovery, and nonprod owner authentication), and one is added (staging version identification).

## Impact

- Scripts: `scripts/obsidian-cloudflare.mjs`, `scripts/obsidian-process.mjs`, the matching tests, and the removal of `scripts/verify-cloudflare.mjs` and its tests.
- Workflow: `.github/workflows/cloudflare.yml` loses its production hostname check and preview deployment check.
- Docs: `docs/cloudflare.md` and `docs/obsidian-cloudflare.md`.
- Trade-off: the release no longer proves that the live site serves the exact bytes of the artifact, or that Access turns strangers away on the live hostnames. Cloudflare's reported deploy result, the retained archive check and the Access API check stand in for them.
- Trade-off: native preview recovery after a lost deployment response now needs the operator, because previews carry no artifact correlation.
