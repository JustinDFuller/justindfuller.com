# Spec Delta

## ADDED Requirements

### Requirement: A thought post chooses its preview image in the same order

A thought post SHALL use the first available of: its valid `image` metadata value, then the first image in its rendered body. A post with neither SHALL have no preview image. The same choice SHALL be made in every environment that renders the post, for both Git-backed and Obsidian-published thought posts. Companion tags SHALL follow the same rules as for programming posts.

#### Scenario: A thought note sets an image

- **WHEN** a thought post has a valid `image` metadata value and also has body images
- **THEN** the `image` value SHALL be its `og:image`, with `twitter:card` set to `summary_large_image`

#### Scenario: A thought post sets no image

- **WHEN** a thought post has no `image` metadata value and its body contains images
- **THEN** the first image in the body SHALL be its `og:image`, with that image's alt text as `og:image:alt` when it has any

#### Scenario: A thought post has no images

- **WHEN** a thought post has no `image` metadata value and no body images
- **THEN** the post SHALL NOT declare `og:image`, `og:image:alt`, or `twitter:card`

#### Scenario: The image value is unusable

- **WHEN** a thought post's `image` value cannot be resolved to a usable image
- **THEN** the post SHALL fall back to its first body image, or SHALL NOT declare an `og:image` if it has none, and SHALL remain published

## MODIFIED Requirements

### Requirement: A page with an image declares it as its social preview image

A programming post or thought post that has a chosen preview image SHALL include exactly one `og:image` tag whose value is an absolute `https` URL. A relative image path SHALL be written as an absolute URL on `https://www.justindfuller.com`. An image already served from `https://media.justindfuller.com` SHALL be used unchanged. A page with no chosen preview image SHALL NOT include an `og:image` tag.

#### Scenario: A page is not a programming post

- **WHEN** a page that is neither a programming post nor a thought post is rendered
- **THEN** it SHALL NOT declare an `og:image`

#### Scenario: A relative path is declared

- **WHEN** the chosen image is the site path `/image/example.png`
- **THEN** the page SHALL declare `https://www.justindfuller.com/image/example.png`

#### Scenario: A media URL is declared

- **WHEN** the chosen image is `https://media.justindfuller.com/v1/<sha256>.png`
- **THEN** the page SHALL declare that exact URL
