# QA

Checks were run on 2026-10-17 against commit `383b2544b8921dd485b4e945abeac4d697ed3134` (the code is unchanged after it; later commits only add this file and its screenshot). The site was run locally with `go run .` on loopback ports. No production or LinkedIn check has been made yet, because that needs the deployed site.

## 4.1 Local server, Git-backed posts and the home page

Commands: `curl -s http://127.0.0.1:9100/<route>` filtered to the title, description, `og:*`, and `twitter:*` tags.

| Page | Result |
| --- | --- |
| `/` (home) | `<title>`, `description`, `og:title` only. No `og:image`, `og:image:alt`, or `twitter:card`. |
| `/programming/javascript-apis-video-api` (no images) | Same: no `og:image`, `og:image:alt`, or `twitter:card`. |
| `/programming/three-reasons-i-avoid-anonymous-js-functions-like-the-plague` (body images, no `image:`) | `og:image` is `https://cdn-images-1.medium.com/max/2000/1*2xJ42hw41svXHKehiJcp6A.png` (the first body image, already absolute), `og:image:alt` is `Stack trace showing named function error`, `twitter:card` is `summary_large_image`. |
| `/programming/qa-image-fixture` (a throwaway Git post with `image: /image/programming/qa-cover.png` and a different first body image, deleted afterwards and never committed) | `og:image` is `https://www.justindfuller.com/image/programming/qa-cover.png`, so `image:` wins over the body image and the relative path is absolutized. No `og:image:alt`, because the `image:` file is not in the body. `twitter:card` is `summary_large_image`. |

Existing pages are unchanged. Against a build of `origin/main` served on another port, the full response bytes (SHA-1) were identical for `/`, `/programming/javascript-apis-video-api`, `/about`, `/poem/`, `/story/nothing`, and `/make`. `/programming` differed only by the throwaway fixture's list entry. The post with body images differed from `main` by exactly the three new tags (`diff` of the two responses).

## 4.2 Local Obsidian overlay

A throwaway vault was created outside the repository with two generated PNGs and three `environment: nonprod` notes. It was prepared with `node scripts/prepare-local-obsidian.mjs --vault <vault>` and served with `OBSIDIAN_OVERLAY=.obsidian-publish/local/prepared.json go run .`. The preparer printed `posts=42 issues=1` with `issueCategories: ["image_not_found"]`, which is the private diagnostic for the bad value below.

| Note | Result |
| --- | --- |
| `image: image/qa-cover.png`, body has no images | `og:image` is `https://www.justindfuller.com/__obsidian/media/v1/59edf555…529e15.png`. That key is the SHA-256 of the cover PNG (checked with `shasum -a 256`). No `og:image:alt`. `twitter:card` is `summary_large_image`. |
| `image: image/qa-cover.png`, body image `qa-body.png` | `og:image` is the cover URL above, not the body image. No `og:image:alt`. |
| `image: image/does-not-exist.png`, body image `qa-body.png` | The post still renders. `og:image` is the body image's media URL (`…/50dd60be…03e8ffc.png`, matching the SHA-256 of `qa-body.png`), `og:image:alt` is `Body alt`. The diagnostic `image_not_found` was recorded in the prepare summary. |

The private media URL is made absolute on the production host, which does not serve `/__obsidian/media/...`. This is the accepted trade-off in the design: private builds are behind access control and are not crawled.

## 4.3 Screenshot

`post-branch.png` shows `/programming/three-reasons-i-avoid-anonymous-js-functions-like-the-plague` rendered from this branch. The page looks like it did before, since the new tags are in the head and are not visible. The post's HTML differs from `main` only by the three new head tags (see 4.1).

Claude Code computer use was not available for this check: another Claude session held the computer-use lock when it was requested (twice), and I did not try to work around that. The screenshot was taken instead with headless Chrome (`--headless=new --screenshot`) against the local server. It is a real browser render of the running site, but it is not the computer-use proof the task named. A same-size capture of `main` was not kept as evidence: the page has an entrance fade-in animation, and a headless capture of the baseline caught it partway through, so the two images differ in brightness even though their HTML matches.

## What this evidence does not prove

- Nothing was crawled or shared. LinkedIn, X, and Slack have not been shown to render a preview, and no Post Inspector run has been made.
- The production `og:image` for "Agentic Spec-Driven Workflow" is unverified until the change deploys and that note gets `image:`.
- No check was made against the live `media.justindfuller.com` host.

## Judgement calls to review

- A blank `image:` value (`image:` or only spaces) is treated as absent and does not raise a diagnostic. The spec does not say either way.
- `og:image` and `og:image:alt` values are HTML-escaped. The site templates use `text/template`, which does not escape on its own, so alt text containing quotes or `&` would otherwise break the tag. A test covers this.
