# Design

## Context

See proposal.md for motivation. The serving adapter (`CloudflareServing`) verified a deployment by running a crawler against every enabled hostname and by fetching a publication marker, and it asserted Access denial against the live hostnames. The transaction layer calls `serving.verify` before the deploy (for the prior version) and after it (for the candidate), and uses the marker to tell its own orphaned deployment from an unrelated one.

## Goals / Non-Goals

**Goals:**

- No request from the release to the published website.
- Keep every safety property that Cloudflare's API and private storage can still prove: single serving version at 100 percent, new identity differs from the prior, Access configuration correct, retained archive intact.
- Keep rollback working through the API.

**Non-Goals:**

- Changing Bot Fight Mode or any Cloudflare zone setting.
- Changing the transaction layer, the journal, or accepted-state handling.
- Making re-runs of failed deploy jobs work, or improving the deploy step's failure summary.

## Decisions

### Verification becomes an API and storage check

`verify` keeps the identity match, the Access configuration check through the Access API, the retained archive check against private storage, and the identity re-check. It drops the crawler subprocess and the marker fetch. The transaction layer is unchanged because it only calls `verify`.

Alternative considered: keep the crawler but run it from an allowed network or with a Bot Fight Mode bypass. Rejected: the Free plan cannot skip Bot Fight Mode with a rule, and the owner wants no dependency on the live site.

### Candidate correlation through the version message

Production and staging deployments already pass the artifact checksum as the version message. `matchesCandidate` reads the serving version through the API and compares its message. This replaces the marker fetch. Previews carry no message, so `matchesCandidate` is false for previews and recovery of an orphaned preview deployment requires the operator. The previous behavior for previews depended on the live marker and could not work with the site unreachable.

### Staging finds its uploaded version through the API

After `cf workers versions create`, staging lists the worker's most recent versions and takes the newest one whose message equals the artifact checksum, then switches traffic to it. If none matches, the deploy fails before any traffic change. Command output is not read, so the next change in where the CLI prints cannot break it again.

Alternative considered: read stderr as well as stdout. Rejected: it keeps the dependence on the exact text of a beta CLI.

### Removed code

The crawler script and its tests, the `verify` subprocess purpose and its Access credentials, the marker counter, and `recoverReceipt` on the serving adapter are removed. `assertAccessDenied` stays because the manual tool `scripts/check-obsidian-access.mjs` uses it.
