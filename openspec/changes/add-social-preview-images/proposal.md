# Proposal

## Why

No page on the site declares an `og:image`. The shared head template (`meta.template.html`) only writes `<title>`, `description`, and `og:title`. Social sites that need a preview image therefore guess one from the page's first `<img>`. That guess worked for older posts, whose images are same-site paths such as `/image/programming/...`. It stopped working for "Agentic Spec-Driven Workflow", whose images are served from `media.justindfuller.com` and whose first image is very wide (3199×1250), so LinkedIn showed no cover image when the link was posted. The fix is to declare the preview image explicitly instead of relying on a guess.

## What Changes

- A page that has a preview image declares it with an `og:image` tag.
- A programming post picks its image in this order: the post's `image:` frontmatter, then the first image in the post body. A post with neither, and every other page, declares no preview image and keeps its current head tags.
- Relative image paths are written as absolute `https://www.justindfuller.com/...` URLs, because crawlers require absolute URLs. Media URLs from `media.justindfuller.com` are already absolute and are used as-is.
- `og:image:alt` is written when the chosen image has alt text in the post body.
- `twitter:card` is `summary_large_image` when a post image is declared. A page with no preview image gets no `twitter:card`.
- Programming posts accept an optional `image:` frontmatter field.
  - Obsidian posts write it like body image references (for example `image: image/1-high-level-workflow.png`). It is resolved to the same public media URL as a body image.
  - Git-backed posts write a site path (for example `/image/programming/example.png`).
  - An Obsidian `image:` that points to a missing, unsupported, or unavailable file drops only that field, falls back to the next choice, and records the same kind of private diagnostic as a bad body image. It never blocks the post. A non-text `image:` value is invalid metadata, like any other field.
- The Obsidian sync's rule that rejects unknown frontmatter keys stays, with `image` added to the allowed keys.
- An image named only by `image:` becomes eligible for public promotion when the effective accepted nondraft production post uses it, the same as a body image.

## Capabilities

### New Capabilities

- `social-preview-images`: how each page chooses and declares its social preview image and related tags.

### Modified Capabilities

- `obsidian-programming-sync`: the post metadata requirement gains the optional `image` key, and the image delivery requirement counts `image:` references the same as body references.

## Impact

- Code: `meta.template.html`, the template data in `site/site.go`, `programming/entries.go` (frontmatter and first-image extraction), `obsidian/validate.go` (allowed key, `image:` resolution through the existing asset index and resolver), and `obsidian/promotion.go` (consumes the same resolver, so it needs no logic change but must stay covered by tests).
- `programming.Entry` gains an `Image` field. It is serialized in prepared Obsidian state, so the design covers compatibility with state saved before this change.
- Social platforms cache previews for days. A post that was already shared may need a re-scrape (LinkedIn Post Inspector) or a fresh post to show the new cover.
- No new dependencies, no change to image storage, hashing, or caching.

## Non-Goals

- Resizing or cropping images. The chosen image's shape is the author's decision; LinkedIn prefers about 1.91:1 and may crop wider images.
- `og:description`, `og:url`, and `og:type`. LinkedIn and X do not need them for a cover image, and `og:url` would have to pick between the apex and `www` hosts, which are both served today.
- Per-section `image:` support for poems, stories, and other content types.
- Generating images automatically.
- A default preview image for pages without one. The 180×180 site icon is likely too small for some platforms, so those pages keep today's text-only preview.
