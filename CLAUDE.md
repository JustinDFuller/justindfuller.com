# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website built with Go serving static HTML with templating. Content organized by type (poems, stories, thoughts, reviews, etc.) with a Josh W. Comeau-inspired dark theme design.

## Commands

### Development
```bash
# Start local server (port 9000) with all validations
make server

# Start server without validations (faster)
make server-fast  

# Watch mode with auto-restart
make server-watch

# Format and lint all code
make format

# Build static assets for production
make build
```

### Testing & Validation
```bash
# Run all formatting and linting
npm test

# Individual linters
npm run lint:js    # ESLint for JavaScript
npm run lint:css   # Stylelint for CSS  
npm run lint:md    # Markdownlint for Markdown

# Go-specific
go vet ./...
golangci-lint run
```

### Deployment
```bash
make deploy  # Deploy to Google App Engine
```

## Architecture

### Content System
- **Entry Types**: Each content type (poem, story, thought, review, etc.) has its own directory with:
  - `entries.go` - Content definitions with markdown files
  - `main.template.html` - List page template
  - `entry.template.html` - Individual entry template  
  - `main.css` / `entry.css` - Type-specific styles
  - `main.js` / `entry.js` - Type-specific JavaScript

### Rendering Pipeline
1. `main.go` - HTTP server that renders templates with content data
2. Templates use Go's `text/template` with shared `meta.template.html`
3. Build process (`build/main.go`) pre-renders pages for production
4. Production serves from Google App Engine (`.appengine/`)

### Styling Approach
- Design system defined in `design-system.md`
- Base styles in root `main.css`
- Component-specific styles in subdirectories
- Dark theme with pink/yellow accents (Josh W. Comeau inspired)

## Key Patterns

### Adding New Content
1. Add markdown file to appropriate directory (e.g., `thought/2025-01-15-title.md`)
2. Update `entries.go` in that directory to include the new entry
3. Content automatically appears on list and gets its own page

### Template Data Structure
```go
type data[T any] struct {
    Title   string
    Meta    string  // SEO meta tags
    Entries []T     // For list pages
    Entry   T       // For single pages
}
```

### Browser Testing
- Always validate changes at http://localhost:9000 using browser MCP tool
- Test responsive design at mobile/tablet/desktop breakpoints

### Git Workflow
- Incrementally commit work as you complete steps
- Main branch deploys automatically via GitHub Actions

## Important Notes

- All styles must align with `design-system.md`
- Preserve dark theme aesthetic with pink/yellow accents
- Maintain Josh W. Comeau-inspired playful yet professional design
- Content files use markdown with frontmatter
- Production build creates static HTML in `.build/` directory