# Frontmatter Schema and Capabilities

This document defines the frontmatter schema and capabilities for the justindfuller.com website, documenting both the current state and the target unified schema.

## Current State Analysis

### Content Types and Their Frontmatter Usage

| Content Type | Frontmatter Present | Processing Method | Fields Used |
|-------------|-------------------|-------------------|-------------|
| **Poems** | Yes (all 48 files) | Ignored - extracts text between \`\`\`text markers | title, date present but not processed |
| **Stories** | Yes (all 4 files) | goldmark-meta | title, date, draft (IsDraft field in struct) |
| **Reviews** | ✅ Yes (all 5 files) | goldmark-meta | title, date, author, category, tags |
| **Thoughts** | Yes (all 15 files) | goldmark-meta | title, date, description |
| **Programming** | Yes (all 29 files) | goldmark-meta | title, date, draft (IsDraft field in struct) |
| **Words** | ✅ Yes (all 4 files) | goldmark-meta | title, date, author, category, tags |
| **Nature** | ✅ Yes (1 file) | goldmark-meta | title, subtitle, date, author, category, tags |
| **About** | ✅ Yes (1 file) | goldmark-meta | title, date, author, category, tags |
| **Aphorisms** | Yes (all 36 files) | goldmark-meta | title, date, draft |

### Go Code Implementation Status

| Content Type | Has goldmark-meta | Extracts Frontmatter | Struct Fields |
|-------------|------------------|---------------------|---------------|
| **Poems** | No | No - custom extraction | None (only raw content) |
| **Stories** | Yes | Yes | Title, Slug, Date, IsDraft, FirstParagraph |
| **Reviews** | ✅ Yes | ✅ Yes (dynamic file reading) | Title, Slug, Date, FirstParagraph |
| **Thoughts** | Yes | Yes | Title, Slug, Date, Description, Content |
| **Programming** | Yes | Yes | Title, Slug, Date, IsDraft, Description, FirstParagraph |
| **Words** | ✅ Yes | ✅ Yes (with H1 removal) | Title, Content, Date |
| **Nature** | ✅ Yes | ✅ Yes (dynamic file reading) | Title, SubTitle, Slug, Markdown, Image, Date |
| **About** | ✅ Yes | ✅ Yes | Title, Content, Date |
| **Aphorisms** | Yes | Yes | ID, Content, Author, Date |

### Template Support Status

All content types use the shared `entry-header.template.html` which supports:
- `.Title` field display
- `.Date` field display with formatting

Individual templates access `.Entry.Content` for the rendered markdown content.

### Existing Frontmatter Fields Found

#### Core Fields (Used by Go Code)
- **title**: Page title (stories, thoughts, programming, aphorisms)
- **date**: Publication date (stories, thoughts, poems, programming, aphorisms)
- **draft**: Hide from public view (stories, programming, aphorisms)

#### Legacy Hugo Fields (Currently Ignored)
- **author**: Always "Justin Fuller"
- **slug**: URL path segment
- **tags**: Content categorization
- **linktitle**: Menu link text
- **menu**: Hugo menu configuration
- **next**: Next page navigation
- **weight**: Sort order
- **images**: Associated images
- **aliases**: URL redirects
- **publishDate**: Scheduled publishing

## Unified Frontmatter Schema

### Required Fields

These fields should be present in all markdown content files:

```yaml
---
title: string        # Display title for the content
date: YYYY-MM-DD    # Publication/creation date
---
```

### Optional Fields

These fields can be added as needed:

```yaml
---
# Content Management
draft: boolean       # If true, hide from public views (default: false)
description: string  # Short summary for listings/SEO (auto-generated if missing)
author: string      # Content author (default: "Justin Fuller")

# URL and Navigation  
slug: string        # URL path segment (default: generated from filename)
aliases: [string]   # Alternative URLs that redirect here

# Categorization
tags: [string]      # Content tags/categories
category: string    # Primary category

# Display
image: string       # Featured image path
images: [string]    # Multiple associated images
excerpt: string     # Custom excerpt (overrides auto-generation)

# SEO and Social
seo_title: string   # Override title for SEO
seo_description: string # Override description for SEO
og_image: string    # Open Graph image override

# Future Capabilities
publishDate: YYYY-MM-DD  # Future publishing date
expiryDate: YYYY-MM-DD   # Content expiration date
lastmod: YYYY-MM-DD      # Last modification date
---
```

## Required Go Code Capabilities

### Core Processing Requirements

1. **Frontmatter Parser**: Use goldmark-meta extension consistently across all content types
2. **Field Extraction**: Extract and validate frontmatter fields
3. **Fallback Logic**: Graceful defaults when frontmatter is missing
4. **Draft Handling**: Respect draft field to hide content

### Implementation Pattern

```go
type ContentEntry struct {
    // Core fields
    Title       string
    Date        time.Time
    Content     template.HTML
    
    // Optional fields
    Draft       bool
    Description string
    Author      string
    Slug        string
    Tags        []string
    Image       string
}
```

### Processing Flow

1. Read markdown file
2. Parse with goldmark + meta extension
3. Extract frontmatter into struct
4. Apply fallback logic:
   - Title: frontmatter → H1 extraction → filename
   - Date: frontmatter → filename parsing → current date
   - Slug: frontmatter → filename
   - Description: frontmatter → first paragraph
5. Filter drafts in production
6. Render content

## Template Requirements

### Data Structure for Templates

```go
type TemplateData struct {
    Title   string       // Page title for <title> tag
    Meta    string       // Meta identifier for icons/manifest
    Entry   ContentEntry // Single entry data
    Entries []ContentEntry // List of entries
}
```

### Template Field Usage

- **meta.template.html**: Uses `.Title` for page title and SEO
- **entry-header.template.html**: Uses `.Title` and `.Date` for entry headers
- **List templates**: Use `.Title`, `.Description`, `.Date` for entry listings
- **Entry templates**: Use `.Content` for body, `.Title` for heading

## Migration Path

### Phase 1: Standardize Processing (Current Focus)
- [ ] Update all content types to use goldmark-meta
- [ ] Implement consistent field extraction
- [ ] Add draft support to all types
- [ ] Remove hardcoded entries

### Phase 2: Content Cleanup
- [ ] Add missing frontmatter to existing files
- [ ] Remove unused Hugo fields
- [ ] Standardize date formats
- [ ] Generate missing descriptions

### Phase 3: Enhanced Features
- [ ] Implement tag-based filtering
- [ ] Add SEO field support
- [ ] Enable scheduled publishing
- [ ] Support content expiration

## Benefits of Unified Schema

1. **Consistency**: Same fields across all content types
2. **Maintainability**: Single processing logic for all content
3. **Flexibility**: Easy to add new fields globally
4. **SEO**: Better meta tag generation
5. **Future-proof**: Room for growth without breaking changes

## Implementation Notes

### Goldmark Configuration

Standard configuration for all content types:

```go
md := goldmark.New(
    goldmark.WithExtensions(extension.GFM, meta.Meta),
    goldmark.WithParserOptions(
        parser.WithAutoHeadingID(),
    ),
    goldmark.WithRendererOptions(
        html.WithHardWraps(),
        html.WithUnsafe(),
    ),
)
```

### Date Parsing

Support multiple date formats:
- `2006-01-02` (preferred)
- `time.RFC3339`
- Filename extraction: `YYYY-MM-DD-*`

### Draft Behavior

- Development: Show all content
- Production: Hide draft=true content
- Build process: Exclude drafts from static generation

## Validation Rules

1. **Title**: Required, non-empty string
2. **Date**: Valid date format or extractable from filename
3. **Draft**: Boolean, defaults to false
4. **Tags**: Array of strings, can be empty
5. **Slug**: Valid URL segment, no spaces or special characters

## Example Frontmatter

### Minimal (Required Fields Only)
```yaml
---
title: My Article Title
date: 2025-01-06
---
```

### Full Featured
```yaml
---
title: Complete Guide to Go Testing
date: 2025-01-06
draft: false
description: Learn Go testing from basics to advanced techniques
author: Justin Fuller
slug: go-testing-guide
tags: [golang, testing, tutorial]
category: programming
image: /images/go-testing.jpg
seo_title: Go Testing Guide - Best Practices and Examples
seo_description: Master Go testing with this comprehensive guide covering unit tests, integration tests, and best practices.
---
```

## Backwards Compatibility

The unified schema maintains backwards compatibility by:
1. Supporting both frontmatter and non-frontmatter files
2. Extracting titles from H1 tags when no frontmatter exists
3. Parsing dates from filenames as fallback
4. Ignoring unknown/legacy fields without errors
5. Maintaining existing URL patterns via slug field