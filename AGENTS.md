# Repository Guidelines

## Project Structure & Module Organization
- `main.go` hosts the HTTP server, wiring content packages such as `about`, `aphorism`, `nature`, and `poem`.
- Each content package keeps a Markdown source (`*.md`), renderer (`entries.go`), template (`main.template.html`), and optional CSS, e.g., `about/`.
- Shared layout templates (`*.template.html`), inline assets, and typography live at the repository root, while static files, icons, and fonts reside in `static/` and `fonts/`.
- Supporting tooling sits in `cmd/generate-css/` for build helpers, `scripts/` for local automation (e.g., `smart-watch.sh`), and the `Makefile` for composite workflows.

## Build, Test, and Development Commands
- `make server` runs validation, generation, linting, and `go run -race .` for a full local preview.
- `make server-fast` skips the expensive preflight steps when you only need a quick rebuild.
- `make format` applies `go fmt`, then runs `npm run test` to format and lint JS/CSS/Markdown.
- `npm run test` (invoked above) chains Prettier, ESLint, Stylelint, and Markdown linting with autofix.
- `make build` produces a race-enabled binary `./justindfuller.com`; use `make deploy` only with valid GAE credentials.

## Coding Style & Naming Conventions
- Go code must stay `gofmt`-clean, idiomatic, and pass the configured `golangci-lint`; keep package names lowercase and match directories.
- Templates follow the `*.template.html` suffix; include partials via Go’s `text/template` helpers declared in `main.go`.
- CSS favors two-space indentation and kebab-case tokens (`--color-bg-primary`), while JS (where present) is linted via `eslint.config.mjs`.
- Run `npm run format` before committing front-end assets; never hand-edit generated artifacts in `justindfuller.com/`.

## Testing Guidelines
- Add Go tests alongside logic-heavy packages using `_test.go` files and `TestXxx` functions; execute with `go test ./...` before invoking the Make targets.
- Snapshot template changes by validating rendered pages through `make server`; ensure new routes expose deterministic data.
- Keep linting green: `make lint-md` fixes Markdown, and `make format` must return zero diffs prior to review.

## Commit & Pull Request Guidelines
- Follow the existing history: concise, Title-Case summaries in imperative voice (`Fix feed redirect`), optionally referencing PR numbers (`(#123)`).
- Group related changes per commit, include rationale in the body when behavior shifts, and avoid noisy formatting-only commits unless isolated.
- PRs should describe scope, testing performed, and any follow-up tasks; link Issues when relevant and attach screenshots for UI-visible tweaks.
