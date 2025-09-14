# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog/website built with Go and served on Google App Engine. It features various content types including programming articles, poems, stories, reviews, and aphorisms.

## Development Commands

### Building and Running
- `make server` - Full build with validation, formatting, and linting before running
- `make server-fast` - Quick server start without checks
- `make build` - Build binary with all checks
- `make build-fast` - Quick build without checks
- `make server-watch-smart` - Smart watch mode that rebuilds on .go changes, restarts on content changes

### Code Quality
- `make lint` - Run golangci-lint (skipped in CI)
- `make format` - Format Go code and run npm test
- `make vet` - Run go vet
- `make tidy` - Run go mod tidy
- `make validate` - Validate JSON/YAML configuration files

### Content
- `make lint-md` - Lint markdown files

### Testing
- `npm run test` - Run JS/CSS linting and formatting
- No Go tests currently exist in the project

### Deployment
- `make deploy` - Deploy to Google App Engine

## Architecture

### Content System
The site organizes content into typed packages, each representing a content category:
- `programming/` - Technical blog posts with syntax highlighting
- `poem/`, `story/`, `review/`, `thought/`, `aphorism/` - Various content types
- Each package has an `entries.go` file that handles markdown parsing and rendering

### Key Components
- **Main Server** (`main.go`): HTTP server with template-based routing
- **Markdown Processing**: Uses goldmark with extensions for syntax highlighting and metadata
- **Templates**: HTML templates in root directory (`.template.html` files)
- **Custom Image Renderer** (`renderer/image.go`): Handles image rendering with captions
- **Syntax Highlighting** (`syntax/highlighting.go`): Code highlighting using chroma

### Content Entry Structure
All content types implement similar Entry structures with:
- Title, Slug, Description, Content (HTML)
- Date parsing from filename (YYYY-MM-DD format)
- Draft support via `draft: true` in frontmatter
- Markdown rendering with goldmark

### Static Assets
- CSS: `main.css` and `inline-content.css`
- Fonts in `fonts/` directory
- Images in `image/` directory

## Development Workflow

### Adding New Content
1. Create markdown file in appropriate directory with `YYYY-MM-DD_slug-name.md` format
2. Add frontmatter if needed (draft status, custom metadata)
3. Server automatically picks up new content on restart

### Modifying Go Code
1. Make changes
2. Run `make lint` to check for issues
3. Use `make server-watch-smart` for development with auto-rebuild

### Working with Templates
- Main page template: `main.template.html`
- Entry page template: `entry-page.template.html`
- Shared components: `header.template.html`, `footer.template.html`

## Important Notes
- Port 9000 is used for local development (configurable via PORT env var)
- Google App Engine deployment uses `.appengine/app.yaml`
- Secrets are managed via secretmanager package (grass.ReminderConfig)
- The `.routes/` directory contains unused route planning code