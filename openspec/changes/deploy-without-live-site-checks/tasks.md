# Tasks

## 1. Remove live-site checks from the release

- [x] 1.1 Make `CloudflareServing.verify` check only the serving identity, the Access configuration through the Access API, the retained archive, and the identity again; remove the crawler subprocess, the marker fetch and the Access denial probes; verify in `scripts/obsidian-cloudflare.test.mjs` that every request in a full deploy, verify and rollback cycle goes to `api.cloudflare.com`
- [x] 1.2 Correlate a candidate to the serving version through the artifact checksum recorded as the version message, and treat native previews as uncorrelated; verify with tests for production, staging, a mismatching message and a preview
- [x] 1.3 Verify that a failed deployment restores the prior version through the API with no website request
- [x] 1.4 Delete `scripts/verify-cloudflare.mjs` and its tests, remove the `verify` subprocess purpose, and remove the two live verification steps from `.github/workflows/cloudflare.yml`
- [x] 1.5 Update `docs/cloudflare.md` and `docs/obsidian-cloudflare.md` to describe verification through the Cloudflare API

## 2. Identify the uploaded staging version through the API

- [x] 2.1 Replace the parsing of command output with a lookup of the newest Worker version whose message equals the artifact checksum; verify with tests for an empty command output, no matching version, an invalid version id and several matching versions

## 3. Proof

- [ ] 3.1 With Bot Fight Mode on, start a fresh `content` run of the Cloudflare workflow on the default branch after this change is merged, and verify with the Cloudflare API and the Actions run page that production and staging both have a new deployment whose version message is the run's artifact checksum
- [ ] 3.2 Record in `qa.md` the run ID, commit, timestamps, Bot Fight Mode state, deployment IDs, screenshots of the green deploy jobs and of the live and staging sites, any failed attempts, and what was not proven

## Workflow follow-up

- Archive the change after review requirements are satisfied.
