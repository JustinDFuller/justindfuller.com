# Website Inventory

## Outstanding Issues

### Minor Issues
1. **Word page links**: Only 2 of 16 words have links to their individual pages (Quality and Flexible)

## Notes

### Poem Pages
* Individual poem pages are not supposed to exist
* Poems are displayed inline on the /poem listing page only

## Summary of Remaining Issues

### Issues Still Needing Attention

1. **Minor Issues**:
   - Most word pages exist but only 2 of 16 are linked from the listing page

## See Also

- **COMPLETED.md** - For all completed fixes and resolved issues

## Frontmatter Analysis

### Poem Files
* /poem/*.md
  * HasFrontMatter: true
  * Fields: author, date, title, slug, tags, publishDate (optional)
  * Issues:
    * Inconsistent use of publishDate field (present in 20.md, 30.md, 40.md but not in 1.md, 10.md)
    * All files use same author "Justin Fuller" and tags ["Poetry"]
    * publishDate when present is always one day before date field

### Poem Support
* poem/entries.go
  * Supports: /poem/*.md files with numeric names only
  * Respects: None - completely ignores all frontmatter fields
  * Doesn't respect: author, date, title, slug, tags, publishDate
  * Processing: Extracts only content between ```text and ``` markers, discards everything else including frontmatter

### Story Files
* /story/*.md
  * HasFrontMatter: Mixed
  * Fields: title (inconsistent), author (optional), date (optional), linktitle (optional), menu (optional), next (optional), weight (optional), images (optional), tags (optional), draft (optional)
  * Issues:
    * Inconsistent frontmatter usage - only 2 of 4 files have frontmatter
    * bridge.md and nothing.md only have title field
    * the_philosophy_of_trees.md has extensive Hugo-style frontmatter with menu/next/weight/images
    * the_philosophy_of_lovers.md has similar Hugo frontmatter and draft: true

### Story Support
* story/entries_list.go + story/entry.go
  * Supports: /story/*.md files with pattern matching
  * Respects: title, date, draft (from frontmatter via goldmark-meta)
  * Doesn't respect: author, linktitle, menu, next, weight, images, tags
  * Processing: Uses goldmark with meta extension to extract frontmatter, falls back to filename parsing for title/date if missing

### Review Files
* /review/*.md
  * HasFrontMatter: false
  * Fields: None - all review files are pure markdown without frontmatter
  * Issues:
    * No frontmatter at all, using H1 headers for titles instead

### Review Support
* review/entries_list.go + review/entry.go
  * Supports: /review/*.md files
  * Respects: title, date (from frontmatter if present, via goldmark-meta)
  * Doesn't respect: N/A (no frontmatter exists)
  * Processing: Uses goldmark with meta extension to extract frontmatter, falls back to extracting title from first H1 tag when no frontmatter exists

### Thought Files
* /thought/*.md
  * HasFrontMatter: Mixed
  * Fields: author, date, linktitle, menu, title, weight, tags, next (optional), images (optional)
  * Issues:
    * Inconsistent frontmatter fields across files
    * 2020-10-24-everything-is-a-product.md: Full Hugo-style frontmatter with menu, weight, tags
    * 2021-11-1-why-did-i-stop-writing?.md: Full Hugo-style frontmatter with next, images fields
    * 2025-04-05-responses.md: Minimal frontmatter (only title)
    * 2025-04-06-existence.md: Minimal frontmatter (only title)
    * Older files have extensive Hugo configuration, newer files have minimal YAML

### Thought Support
* thought/entries.go
  * Supports: /thought/*.md files dynamically scanned from filesystem
  * Respects: title, date (from frontmatter via goldmark-meta)
  * Doesn't respect: author, linktitle, menu, weight, tags, next, images
  * Processing: Uses goldmark with meta extension to extract frontmatter, falls back to filename parsing for date/title, generates description from first paragraph

### Programming Files
* /programming/*.md
  * HasFrontMatter: true
  * Fields: author, date, linktitle, menu, next, title, weight, images, aliases (optional), tags, draft (optional)
  * Issues:
    * Consistent Hugo-style frontmatter across all sampled files
    * All files have full frontmatter with author "Justin Fuller", menu parent "posts", weight 1
    * 2023-02-11_my_javascript_style_guide.md has draft: true (intentionally hidden)
    * Some files have aliases for URL redirects
    * Most files have images array and tags [Code] or [Life]

### Programming Support
* programming/entries.go
  * Supports: /programming/*.md files embedded at compile time with go:embed
  * Respects: draft (from frontmatter via parseMarkdownWithMeta function)
  * Doesn't respect: author, date, linktitle, menu, next, title, weight, images, aliases, tags
  * Processing: Uses hardcoded Entry structs with manual title/slug/description/date values, calls parseMarkdownWithMeta only for draft detection

### Word Files
* /word/*.md
  * HasFrontMatter: false
  * Fields: None - all word files are pure markdown without frontmatter
  * Issues:
    * No frontmatter at all, using H1 headers for titles instead

### Word Support
* word/entry.go
  * Supports: /word/*.md files (dynamically loaded via file names)
  * Respects: title, date (from frontmatter via goldmark-meta if present)
  * Doesn't respect: N/A (no frontmatter exists)
  * Processing: Uses goldmark with meta extension to extract frontmatter, falls back to extracting title from first H1 tag when no frontmatter exists, then removes H1 from content to avoid duplication

### Nature Files
* /nature/*.md
  * HasFrontMatter: false
  * Fields: None - nature files are pure markdown without frontmatter
  * Issues:
    * Only one markdown file exists (anolis-carolinensis.md)
    * No frontmatter at all, content is pure markdown

### Nature Support
* nature/entry.go
  * Supports: /nature/*.md files but uses hardcoded Entry structs
  * Respects: None - completely ignores any frontmatter that might exist
  * Doesn't respect: All frontmatter fields (processing doesn't use goldmark-meta)
  * Processing: Uses hardcoded Entry structs with manual title/subtitle/slug/image values, loads markdown content but ignores any potential frontmatter

### About Files
* /about/about.md
  * HasFrontMatter: false
  * Fields: None - about file is pure markdown without frontmatter
  * Issues:
    * No frontmatter at all, starts directly with H2 header

### About Support
* about/entries.go
  * Supports: /about/about.md file (embedded at compile time with go:embed)
  * Respects: None - processing doesn't use goldmark-meta
  * Doesn't respect: All frontmatter fields (no meta extension used)
  * Processing: Uses embedded file content, converts markdown to HTML with goldmark but no meta extension

### Aphorism Files
* /aphorism/*.md
  * HasFrontMatter: true
  * Fields: title, date, draft, description, author, slug, tags, weight
  * Issues:
    * None - converted to markdown format with consistent frontmatter (2025-09-06)
  * Note: Original entries.txt file preserved for reference

### Aphorism Support
* aphorism/entries.go
  * Supports: /aphorism/*.md files (dynamically loaded)
  * Respects: title, date, draft, description, author, slug, tags, weight (from frontmatter via goldmark-meta)
  * Processing: Uses goldmark with meta extension to extract frontmatter and content, supports individual entry retrieval by number

## Frontmatter Inconsistencies Summary

### Major Inconsistencies

1. **Mixed Frontmatter Usage Across Content Types**:
   - Poems: Have extensive Hugo-style frontmatter but it's completely ignored
   - Stories: Mixed usage (2/4 files have frontmatter, goldmark-meta used)
   - Reviews: No frontmatter at all (use H1 headers, goldmark-meta used as fallback)
   - Thoughts: Mixed frontmatter (newer files minimal, older files Hugo-style, goldmark-meta used)
   - Programming: Consistent Hugo-style frontmatter but mostly ignored (only draft field used)
   - Words: No frontmatter (use H1 headers, goldmark-meta used as fallback)
   - Nature: No frontmatter, hardcoded entries
   - About: No frontmatter, embedded content
   - Aphorisms: Consistent frontmatter (converted from .txt file)

2. **Frontmatter Processing Inconsistencies**:
   - Poems: Frontmatter completely ignored, content extracted via text markers
   - Stories/Thoughts: Use goldmark-meta extension properly
   - Programming: Hardcoded structs with only draft field respected
   - Reviews/Words: Use goldmark-meta as fallback when no frontmatter exists
   - Nature/About: No frontmatter support at all
   - Aphorisms: Use goldmark-meta extension properly

3. **Field Usage Inconsistencies**:
   - Date handling varies: some parse from frontmatter, others from filename, others hardcoded
   - Title handling: frontmatter vs H1 extraction vs hardcoded vs filename parsing
   - Draft support only in stories and programming (inconsistently implemented)
   - Hugo-style fields (menu, weight, next, images, aliases) present but ignored

### Recommendations

1. **Standardize frontmatter usage**: Either adopt consistent frontmatter across all content types or standardize on no frontmatter
2. **Consistent processing**: All content types should use goldmark-meta extension if frontmatter is supported
3. **Remove unused Hugo fields**: Clean up legacy Hugo frontmatter fields that aren't being used
4. **Standardize draft handling**: Implement consistent draft field support across all content types
5. **Date handling**: Standardize whether dates come from frontmatter, filenames, or are hardcoded
6. **Title extraction**: Consistent approach to title handling (frontmatter vs H1 vs filename vs hardcoded)