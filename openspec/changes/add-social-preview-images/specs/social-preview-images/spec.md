# Spec Delta

## Purpose

Defines how a page of the site declares a social preview image when it has one, so link previews on LinkedIn, X, Slack, and similar sites show a cover image instead of relying on the crawler's guess.

## ADDED Requirements

### Requirement: A page with an image declares it as its social preview image

A programming post that has a chosen preview image SHALL include exactly one `og:image` tag whose value is an absolute `https` URL. A relative image path SHALL be written as an absolute URL on `https://www.justindfuller.com`. An image already served from `https://media.justindfuller.com` SHALL be used unchanged. A page with no chosen preview image SHALL NOT include an `og:image` tag.

#### Scenario: A page is not a programming post

- **WHEN** a page that is not a programming post is rendered
- **THEN** it SHALL NOT declare an `og:image`

#### Scenario: A relative path is declared

- **WHEN** the chosen image is the site path `/image/example.png`
- **THEN** the page SHALL declare `https://www.justindfuller.com/image/example.png`

#### Scenario: A media URL is declared

- **WHEN** the chosen image is `https://media.justindfuller.com/v1/<sha256>.png`
- **THEN** the page SHALL declare that exact URL

### Requirement: A programming post chooses its preview image in a fixed order

A programming post SHALL use the first available of: its valid `image` metadata value, then the first image in its rendered body. A post with neither SHALL have no preview image. The same choice SHALL be made in every environment that renders the post.

#### Scenario: The post sets an image

- **WHEN** a post has a valid `image` metadata value and also has body images
- **THEN** the `image` value SHALL be its `og:image`, even if it is not the first body image

#### Scenario: The post sets no image

- **WHEN** a post has no `image` metadata value and its body contains images
- **THEN** the first image in the body SHALL be its `og:image`

#### Scenario: The post has no images

- **WHEN** a post has no `image` metadata value and no body images
- **THEN** the post SHALL NOT declare an `og:image`

#### Scenario: Image-like text is only code

- **WHEN** a post's body mentions an image tag only inside a code block or inline code
- **THEN** that text SHALL NOT be used as the post's preview image

#### Scenario: The `image` value is unusable

- **WHEN** a post's `image` value cannot be resolved to a usable image
- **THEN** the post SHALL fall back to its first body image, or SHALL NOT declare an `og:image` if it has none, and SHALL remain published

### Requirement: Companion tags describe the preview image

When the chosen image has alt text in the post body, the page SHALL declare it as `og:image:alt`. A page that declares an `og:image` SHALL declare `twitter:card` as `summary_large_image`. A page that declares no `og:image` SHALL NOT declare `og:image:alt` or `twitter:card`.

#### Scenario: A body image with alt text is chosen

- **WHEN** the chosen image appears in the post body with alt text
- **THEN** the page SHALL declare that alt text as `og:image:alt`

#### Scenario: The chosen image has no alt text

- **WHEN** the chosen image has no alt text, such as an `image` value not used in the body
- **THEN** the page SHALL NOT declare `og:image:alt`

#### Scenario: A preview image is declared

- **WHEN** a page declares an `og:image`
- **THEN** the page SHALL declare `twitter:card` as `summary_large_image`

#### Scenario: No preview image is declared

- **WHEN** a page has no chosen preview image
- **THEN** the page SHALL NOT declare `og:image`, `og:image:alt`, or `twitter:card`

### Requirement: Existing page metadata is unchanged

Adding preview tags SHALL NOT change any page's title, `description`, `og:title`, icons, or manifest links.

#### Scenario: An existing page is rendered

- **WHEN** any page is rendered after this change
- **THEN** its title, `description`, and `og:title` values SHALL equal those it had before this change
