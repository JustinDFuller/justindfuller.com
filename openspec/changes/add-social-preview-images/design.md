# Design

## Context

See proposal.md for why. Current state:

- `meta.template.html` is included by every page template. It receives the `data[T]` struct built in `site/site.go` (`Title`, `SubTitle`, `Meta`, `Entry`, `Entries`) and writes no image tags.
- Programming posts come from two sources that both produce a `programming.Entry`.
  - Git-backed posts: `programming.parseEntry` renders Markdown with goldmark and reads front matter with `goldmark-meta`, which tolerates any key.
  - Obsidian posts: `obsidian.validateMarkdown` validates a strict key list, rewrites each body image reference to its resolved URL, renders through `programming.RenderMarkdown`, and builds the `Entry` itself.
- Body images are rendered by `renderer/image.go` as `<figure><img src alt></figure>`. Obsidian image URLs are `https://media.justindfuller.com/<key>` in production and the origin-relative `/__obsidian/media/<key>` in staging, PR previews, and local builds.
- Every Obsidian image lookup goes through a `resolve` callback that records which images a post uses. Public promotion (`ValidateImagePromotion`) only authorizes images recorded this way.
- `Entry` is serialized into the prepared Obsidian document, whose digest is verified on load.
- `/image/icon.png` is 180×180 and already served by the site.

## Goals / Non-Goals

**Goals:**

- One place decides a page's preview image, used identically for Git-backed and Obsidian posts.
- `image:` on an Obsidian post follows the exact same resolution, diagnostics, and promotion path as a body image, so no new privacy path is created.

**Non-Goals:**

- Anything listed under Non-Goals in proposal.md.
- Checking that a Git-backed `image:` file exists. Git content is reviewed in the PR, and the proof step looks at the rendered tag.

## Decisions

### Derive the first body image from rendered HTML

`programming` gains a helper that scans an entry's rendered `Content` with the `golang.org/x/net/html` tokenizer (already a dependency of `obsidian`) and returns the `src` and `alt` of the first `<img>`, or of the `<img>` whose `src` equals a given URL.

- Why: rendered HTML is the only form both sources share, and by then Obsidian references are already rewritten to their final URLs. Code samples are escaped in rendered HTML, so image-like text inside code is never matched (see the code-block scenario in the spec).
- Alternative: walk the goldmark AST during render. Rejected because the Obsidian path builds its `Entry` from a separate render call and would need the same plumbing twice, and raw `<img>` tags in Git-backed posts would be missed.
- Alternative: a regular expression over the HTML. Rejected as fragile for attribute order and quoting.

### Store only the explicit image on `Entry`

`Entry` gains `Image string` tagged `json:",omitempty"`. It holds only the explicit `image:` value: the resolved URL for Obsidian posts, the site path or `https` URL for Git-backed posts. The first-body-image fallback and the alt text are computed at render time from `Content`, not stored.

- Why: derived values would drift from `Content`, and `omitempty` keeps the prepared-document digest unchanged for every post without `image:`, so documents prepared before the change still verify. Accepted Obsidian state stores raw Markdown and re-derives entries on each run, so no stored `Entry` needs migrating.
- Alternative: store the final chosen image on `Entry`. Rejected for the drift reason and because it would change the digest of every prepared post.

### Resolve Obsidian `image:` through the existing body-image path

`image` joins the allowed metadata keys and must be text. `validateMarkdown` resolves it with the same `resolveAsset` rules and the same `resolve` callback used for body images, then sets `Entry.Image` to the returned URL. A failure records an image issue with the same categories (`image_not_found`, `image_not_ready`, and so on) scoped to the post's route, leaves `Entry.Image` empty, and does not fail the post.

- Why: the callback is what records usage, so `ValidateImagePromotion`, `PrepareAccepted`, and the fallback path authorize and revalidate the image with no new logic. A nonprod or draft post's `image:` is excluded from promotion for free because those posts never reach the collection that is promoted.
- The `image:` call and the body-image calls may resolve the same file. The callbacks only add to maps, so repeating them is harmless.
- Alternative: resolve `image:` later in the site layer. Rejected because it would bypass the privacy and promotion checks.

### Absolute URLs and cards are decided in Go, not the template

`site/site.go` gains a small helper used wherever it builds `data[T]` for a programming post. It picks the image in spec order and returns the absolute URL, the alt text, and whether the icon fallback was used. `data[T]` gains `Image` and `ImageAlt` strings plus an `ImageIsIcon` flag (an empty `Image` means the site icon), and `meta.template.html` renders `og:image`, `og:image:alt` (only when non-empty), and `twitter:card` from them. All other pages leave the fields empty and get the icon.

- Why: the template stays declarative, and URL handling is unit-testable in Go.
- Absolutizing: a value starting with `/` is prefixed with `https://www.justindfuller.com`; a value starting with `https://` is used as-is; anything else is ignored. The `www` host is the one the author shares, and it serves every path.
- Alternative: compute in the template. Rejected because `html/template` makes string handling awkward and untestable.

### Keep `description`, `og:title`, and `og:url` untouched

See the proposal's Non-Goals. Existing tags are unchanged, which a spec scenario pins.

## Risks / Trade-offs

- [Private builds advertise a non-crawlable image URL] In staging, PR previews, and local builds, Obsidian image paths are `/__obsidian/media/...`, so the absolutized `og:image` points at the production host where that path does not exist. → Acceptable: those environments are behind access control and are not crawled, and production is the only environment whose tags matter. Proof for production is taken from the deployed page.
- [Wide images may be cropped] The example post's image is about 2.56:1 and LinkedIn prefers about 1.91:1. → Out of scope; the author chooses the image.
- [Cached previews] Platforms cache previews for days. → The proof step runs LinkedIn Post Inspector against the live URL to force a re-scrape; a post that was already shared may still need a new share.
- [A Git-backed `image:` typo yields a broken preview] No existence check is made for Git-backed values. → Mitigated by PR review and by the rendered-tag proof step.
- [Entry JSON shape changes] → `omitempty` keeps existing digests stable; tests cover a post with and without `image`.

## Migration Plan

No data migration. Deploy normally. After production deploy, run Post Inspector for the example post and add `image: image/1-high-level-workflow.png` to its front matter in Obsidian (the image is already in its body, so no new image needs promotion). Rollback is reverting the PR; posts that already carry `image:` would then be rejected as an unknown key, so remove the field from any post before reverting.

## Open Questions

None.
