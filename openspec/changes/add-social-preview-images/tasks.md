# Tasks

## 1. Choose the preview image for a post

- [ ] 1.1 Add `Image string` (tagged `json:",omitempty"`) to `programming.Entry` and read an `image` front matter value in `parseEntry` for Git-backed posts, keeping only values that start with `/` or `https://`; verify with a test in `programming/entries_test.go` that a valid value is kept, an invalid or missing value leaves it empty, and the list-view parser is unaffected
- [ ] 1.2 Add a helper in `programming` that returns the `src` and `alt` of the first `<img>` in rendered content, or of the `<img>` matching a given `src`, using the `golang.org/x/net/html` tokenizer; verify with tests in `programming/entries_test.go` covering no image, several images, a matching `src`, a raw HTML image, and image-like text inside a code block and inline code (not matched)
- [ ] 1.3 Verify with a test that marshaling an `Entry` without `Image` produces the same JSON as before this change, so existing prepared-document digests still verify

## 2. Accept `image:` on Obsidian posts

- [ ] 2.1 Add `image` to `allowedMetadataKeys` and `metadata`, require it to be text, and resolve it in `validateMarkdown` with `resolveAsset` and the same `resolve` callback as body images, setting `Entry.Image` to the returned URL; verify with tests in `obsidian/prepare_test.go` that a valid `image:` is accepted in production and in private modes (`/__obsidian/media/...` URL), that a non-text value fails only that file, and that other unknown keys are still rejected
- [ ] 2.2 Record an image issue scoped to the post's route when `image:` is missing, ambiguous, unsupported, or not ready, leave `Entry.Image` empty, and keep the post; verify with tests in `obsidian/prepare_test.go` for each category and that the post still publishes
- [ ] 2.3 Verify with tests in `obsidian/promotion_test.go` and `obsidian/prepare_test.go` that an image named only by `image:` of an accepted production nondraft post is promoted, and that one named only by a nonprod or draft post is not, and that `PrepareAccepted` fallback revalidation reproduces the same `Entry.Image`

## 3. Render the tags

- [ ] 3.1 Add `Image`, `ImageAlt`, and an icon-fallback flag to `data[T]` in `site/site.go` and a helper that picks the image in spec order (`image:`, first body image, site icon), makes it absolute (`/`-prefixed values get `https://www.justindfuller.com`, `https://` values are unchanged, anything else is ignored), and finds its alt text; use it for programming posts and leave other pages on the icon; verify with unit tests in `site/` for every row of the spec's order and URL scenarios
- [ ] 3.2 Render `og:image`, `og:image:alt` (only when non-empty), and `twitter:card` (`summary_large_image`, or `summary` for the icon) in `meta.template.html`; verify with an HTTP-level test in `main_test.go` that the home page, the programming list, an image-less post, a post with body images, and a post with `image:` each render the expected tags once, and that `<title>`, `description`, and `og:title` are byte-identical to before
- [ ] 3.3 Verify the static export still passes its link validation and matches the server output (`TestStaticExportMatchesServer`) with the new tags present
- [ ] 3.4 Document the optional `image:` key (reference forms, fallback order, absolute URL behavior) in `docs/obsidian-cloudflare.md` next to the `environment` and `draft` documentation, and verify the documented example validates in a test fixture

## 4. End-to-end proof

Proof is gathered by running the real site and recorded in `qa.md` in this change folder, with screenshots saved under `qa/` and repeated in the PR description. Screenshots must show nothing private; any that do are recaptured, not redacted. Pre-merge checks use the local server and the protected PR preview; the production and LinkedIn checks happen after merge (see Workflow follow-up).

- [ ] 4.1 Run `make server` and verify with `curl` that the head of an image-less post, a Git-backed post with body images, a Git-backed post with `image:`, and the home page each contain the expected tags; record the commands and output in `qa.md`
- [ ] 4.2 With a throwaway nonprod Obsidian-format fixture post that sets `image:` to an image not used in the body, verify with the local Obsidian overlay (`OBSIDIAN_OVERLAY`) that the rendered `og:image` is the private media URL made absolute, and that a second fixture with a bad `image:` falls back to its first body image with a private diagnostic; record results in `qa.md`
- [ ] 4.3 Use Claude Code computer use to open the post locally in a browser and screenshot the page; verify the page itself is visually unchanged (the tags are not visible), and record the screenshot in `qa/`
- [ ] 4.4 Complete `qa.md` with the commit, timestamps, each check's outcome including failed attempts, and what the evidence does not prove (no production crawl yet), then copy its summary and screenshots into the PR description

## Workflow follow-up

- After the implementation PR merges and production deploys: add `image: image/1-high-level-workflow.png` to the "Agentic Spec-Driven Workflow" note in Obsidian, wait for the sync to publish it, and verify with `curl` that the live page's `og:image` is the `media.justindfuller.com` URL for that image.
- Run LinkedIn Post Inspector on the live URL (needs the owner's LinkedIn login) to force a re-scrape, screenshot the resulting card, and add it to `qa.md`.
- Do not add `image:` to any note before production has deployed the implementation, or the sync will reject that note as having an unknown key.
- Archive the change after review requirements are satisfied.
- Verify the archived specification contains the added and modified requirements.
