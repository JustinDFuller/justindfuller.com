# QA

Checks 4.1 and 4.2 were run on 2026-10-17 against commit `383b2544b8921dd485b4e945abeac4d697ed3134`. The fixes under "Adversarial and scope reviews" came after them and change only malformed `image:` values and non-ASCII paths, which those checks did not use. The site was run locally with `go run .` on loopback ports. No production or LinkedIn check has been made yet, because that needs the deployed site.

## 4.1 Local server, Git-backed posts and the home page

Commands: `curl -s http://127.0.0.1:9100/<route>` filtered to the title, description, `og:*`, and `twitter:*` tags.

| Page                                                                                                                                                                          | Result                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/` (home)                                                                                                                                                                    | `<title>`, `description`, `og:title` only. No `og:image`, `og:image:alt`, or `twitter:card`.                                                                                                                                                                       |
| `/programming/javascript-apis-video-api` (no images)                                                                                                                          | Same: no `og:image`, `og:image:alt`, or `twitter:card`.                                                                                                                                                                                                            |
| `/programming/three-reasons-i-avoid-anonymous-js-functions-like-the-plague` (body images, no `image:`)                                                                        | `og:image` is `https://cdn-images-1.medium.com/max/2000/1*2xJ42hw41svXHKehiJcp6A.png` (the first body image, already absolute), `og:image:alt` is `Stack trace showing named function error`, `twitter:card` is `summary_large_image`.                             |
| `/programming/qa-image-fixture` (a throwaway Git post with `image: /image/programming/qa-cover.png` and a different first body image, deleted afterwards and never committed) | `og:image` is `https://www.justindfuller.com/image/programming/qa-cover.png`, so `image:` wins over the body image and the relative path is absolutized. No `og:image:alt`, because the `image:` file is not in the body. `twitter:card` is `summary_large_image`. |

Existing pages are unchanged. Against a build of `origin/main` served on another port, the full response bytes (SHA-1) were identical for `/`, `/programming/javascript-apis-video-api`, `/about`, `/poem/`, `/story/nothing`, and `/make`. `/programming` differed only by the throwaway fixture's list entry. The post with body images differed from `main` by exactly the three new tags (`diff` of the two responses).

## 4.2 Local Obsidian overlay

A throwaway vault was created outside the repository with two generated PNGs and three `environment: nonprod` notes. It was prepared with `node scripts/prepare-local-obsidian.mjs --vault <vault>` and served with `OBSIDIAN_OVERLAY=.obsidian-publish/local/prepared.json go run .`. The preparer printed `posts=42 issues=1` with `issueCategories: ["image_not_found"]`, which is the private diagnostic for the bad value below.

| Note                                                        | Result                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image: image/qa-cover.png`, body has no images             | `og:image` is `https://www.justindfuller.com/__obsidian/media/v1/59edf555…529e15.png`. That key is the SHA-256 of the cover PNG (checked with `shasum -a 256`). No `og:image:alt`. `twitter:card` is `summary_large_image`.             |
| `image: image/qa-cover.png`, body image `qa-body.png`       | `og:image` is the cover URL above, not the body image. No `og:image:alt`.                                                                                                                                                               |
| `image: image/does-not-exist.png`, body image `qa-body.png` | The post still renders. `og:image` is the body image's media URL (`…/50dd60be…03e8ffc.png`, matching the SHA-256 of `qa-body.png`), `og:image:alt` is `Body alt`. The diagnostic `image_not_found` was recorded in the prepare summary. |

The private media URL is made absolute on the production host, which does not serve `/__obsidian/media/...`. This is the accepted trade-off in the design: private builds are behind access control and are not crawled.

## 4.3 Screenshot

`post-branch.png` shows `/programming/three-reasons-i-avoid-anonymous-js-functions-like-the-plague` rendered from this branch. The page looks like it did before, since the new tags are in the head and are not visible. The post's HTML differs from `main` only by the three new head tags (see 4.1).

Claude Code computer use was not available for this check: another Claude session held the computer-use lock when it was requested (twice), and I did not try to work around that. The screenshot was taken instead with headless Chrome (`--headless=new --screenshot`) against the local server. It is a real browser render of the running site, but it is not the computer-use proof the task named. A same-size capture of `main` was not kept as evidence: the page has an entrance fade-in animation, and a headless capture of the baseline caught it partway through, so the two images differ in brightness even though their HTML matches.

## Adversarial and scope reviews

A fresh-context scope check found no change outside the spec. A fresh-context adversarial review found no privacy leak, injection path, or spec violation, and these defects, which were fixed in the follow-up commit:

- A protocol-relative value such as `//cdn.example.com/a.png` was turned into `https://www.justindfuller.com//cdn.example.com/a.png`, and `https://` with no host was accepted. Both are now treated as unusable for `image:` and for a body image, with tests.
- A Git `image:` containing non-ASCII characters or spaces did not match the URL-escaped `src` the renderer writes, so its alt text was lost and `og:image` carried the raw characters. The value is now URL-escaped the same way as body images before it is matched and declared, with a test.
- Task 3.2 asked for a check that the title, `description`, and `og:title` are unchanged. `TestPreviewDoesNotChangeExistingTitleTags` now asserts them for the home page and for posts with and without images.

No HTTP-level test renders a Git-backed post with `image:`, because the `site` package reads `./nature` at init and cannot build a site from its own test directory. That path is covered by parser and `previewImage` unit tests and by the throwaway-fixture `curl` check in 4.1.

## What this evidence does not prove

- Nothing was crawled or shared. LinkedIn, X, and Slack have not been shown to render a preview, and no Post Inspector run has been made.
- The production `og:image` for "Agentic Spec-Driven Workflow" is unverified until the change deploys and that note gets `image:`.
- No check was made against the live `media.justindfuller.com` host.

## Judgement calls to review

- An `image: ""` or whitespace-only value is treated as absent and does not raise a diagnostic. A bare `image:` with no value is YAML null, which is not text, so it fails that file as invalid metadata, the same as a bare `subtitle:` does today. The spec says non-text values are invalid, so this follows it, but Obsidian's property editor can create an empty property, so a note could be rejected by accident.
- `image:` accepts a file name or path (for example `image/cover.png`), the same reference forms the docs show for standard Markdown images. It does not accept the wikilink wrappers `[[cover.png]]` or `![[cover.png]]`, which a body embed does accept. The spec says "the same reference forms as a body image", which could be read either way.
- If the first body image is unusable (for example an `http://` or relative path), the post declares no `og:image` rather than trying its second image. The spec says "the first image in its rendered body".
- `og:image` and `og:image:alt` values are HTML-escaped. The site templates use `text/template`, which does not escape on its own, so alt text containing quotes or `&` would otherwise break the tag. A test covers this.
