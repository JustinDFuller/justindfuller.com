# Website Inventory

## Home Page
* URL: http://localhost:9000
* Issues:
  * **Browser MCP Tool Bug**: Explore navigation links are present in HTML but not detected by browser MCP tool snapshot (accessibility issue or tool limitation)

## Main Category Pages

### Poems
* URL: http://localhost:9000/poem
* Issues:
  * **Browser MCP Tool Bug**: Poem entries ARE present in HTML but not detected by browser MCP tool (shows poem cards with content in HTML)
  * Has footer with Explore/Links sections

### Stories  
* URL: http://localhost:9000/story
* Issues:
  * "The Philosophy of Lovers" is marked as draft (intentional - not ready for publication)
  * Has footer with Explore/Links sections

### Thoughts
* URL: http://localhost:9000/thought
* Issues:
  * Has footer with Explore/Links sections
  * Links to non-existent "/tags/poetry" in one article

### Reviews
* URL: http://localhost:9000/review
* Issues:
  * Has footer with Explore/Links sections

### Programming
* URL: http://localhost:9000/programming
* Issues:
  * Has footer with Explore/Links sections

### Words
* URL: http://localhost:9000/word
* Inconsistencies:
  * Different format than other pages - shows all words inline instead of article cards
  * Missing individual word pages (only shows definitions inline)
  * Two entries missing headings ("Quality" and "Flexible" have empty h2 tags)
  * Has footer with Explore/Links sections

### About
* URL: http://localhost:9000/about
* Issues:
  * Has footer with Explore/Links sections

## Additional Pages Found in Footer Navigation

### Aphorism
* URL: http://localhost:9000/aphorism
* Issues:
  * **Browser MCP Tool Bug**: Aphorism entries ARE present in HTML but not detected by browser MCP tool (shows aphorism cards with text in HTML)
  * Has footer with Explore/Links sections

### Project (Make)
* URL: http://localhost:9000/make
* Issues:
  * Has footer with Explore/Links sections
  * Shows projects properly

### Nature
* URL: http://localhost:9000/nature
* Issues:
  * **FIXED**: ~~Different header navigation (shows Poems/Stories/Thoughts/Projects instead of GitHub/LinkedIn/Email)~~
  * **FIXED**: ~~Has toggle menu button not present on other pages~~
  * **FIXED**: ~~Different footer structure and styling~~
  * **FIXED**: ~~Footer shows "© 2024" instead of "© 2025" like other pages~~
  * Only one image is a clickable link (Anolis Carolinensis) - by design, others are gallery images

## Cross-Page Inconsistencies
1. **Word page format**: Uses different layout than all other content pages
2. **Navigation links**: Footer includes links to sections not visible from homepage (Aphorism, Project/Make, Nature)

## Individual Content Pages

### Poem Pages
* Note: Individual poem pages are not supposed to exist
* Poems are displayed inline on the /poem listing page only

### Story Pages  
* URL Pattern: /story/{slug}
* Example: /story/the_philosophy_of_trees
* Status: Working properly with footer

### Thought Pages
* URL Pattern: /thought/{date-slug}
* Example: /thought/2022-02-22-embracing-impostor-syndrome
* Status: Working properly with footer

### Review Pages
* URL Pattern: /review/{slug}
* Example: /review/living-on-24-hours-a-day
* Status: Working properly with footer

### Programming Pages
* URL Pattern: /programming/{slug}
* Example: /programming/why-do-we-fall-into-the-rewrite-trap
* Status: Working properly with footer

### Word Pages
* URL Pattern: /word/{word}
* Example: /word/quality
* Issues:
  * Individual word pages appear to work from homepage link
  * But no individual pages linked from /word listing page

## Summary of Major Issues

### VERIFIED REAL ISSUES (Need Fixing)

1. **Content Issues**:
   - **RESOLVED**: "The Philosophy of Lovers" story is marked as draft (intentional - not ready for publication)
   - **FALSE POSITIVE**: Word headings for Quality and Flexible are actually present (not empty h2 tags)

2. **Design Inconsistencies**:
   - **FIXED**: ~~Nature page has completely different design/navigation (shows Poems/Stories/Thoughts/Projects instead of GitHub/LinkedIn/Email)~~
   - **CONFIRMED**: Word page uses inline display instead of card layout (no .word-card classes)
   - **FIXED**: ~~Nature page shows "© 2024" while all others show "© 2025"~~

3. **Navigation Issues**:
   - **FALSE POSITIVE**: /tags/poetry link exists and returns valid HTML (not broken)
   - **FALSE POSITIVE**: Footer links (Aphorism, Project/Make, Nature) ARE visible from homepage in the Explore section

### BROWSER MCP TOOL LIMITATIONS (Not Website Issues)

1. **Accessibility Concerns** - Content is present in HTML but Browser MCP tool cannot detect:
   - **VERIFIED**: Homepage Explore navigation links are present in HTML (10 links found)
   - **VERIFIED**: Poem entries on /poem page are present in HTML (48 poem cards found)
   - **VERIFIED**: Aphorism entries on /aphorism page are present in HTML (36 aphorism cards found)
   - **NOTE**: These may indicate accessibility issues that screen readers could also face, worth investigating further

## Fixes Applied

### Nature Page Alignment Fix (Completed)
- **Problem**: Nature page had different header/footer templates and outdated copyright year
- **Solution**: Updated nature/main.html.tmpl to use shared header and footer templates
- **Files Modified**:
  - nature/main.html.tmpl: Replaced custom header/footer with shared templates
- **Result**: Nature page now consistent with rest of site while preserving unique photo grid layout

### Font Loading Accessibility Fix (Completed)
- **Problem**: JavaScript was hiding content with `visibility: hidden` during font loading
- **Solution**: Removed all font loading JavaScript and rely on CSS `font-display: swap`
- **Files Modified**:
  - Emptied 13 JavaScript files (main.js, poem/main.js, aphorism/main.js, etc.)
  - Removed script includes from 14 template files
- **Result**: Content now always visible (with brief font swap flash), but Browser MCP tool still cannot detect content
- **Conclusion**: The accessibility issue is deeper than font loading - may be a Browser MCP tool limitation or other rendering issue

### CSS Animation Accessibility Fix (Completed)
- **Problem**: Elements starting with `opacity: 0` for animations were inaccessible to Browser MCP tool
- **Solution**: Changed animation approach from `opacity: 0` + `forwards` to using `animation-fill-mode: both`
- **Files Modified**:
  - main.css: Fixed `.featured-post`, `.section-link`, and `.category-card` classes
- **Result**: 
  - Homepage Explore navigation now detected by Browser MCP tool (partial improvement)
  - Poem and Aphorism content still not detected (appears to be a deeper Browser MCP tool limitation)
  - Content is always visible in HTML and accessible to users

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
* Note: Aphorisms use entries.txt file and hardcoded Go structs, not markdown files
  * No markdown files exist in aphorism directory
  * Content is stored in entries.txt and parsed by entries.go

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
   - Aphorisms: No markdown files (use .txt file)

2. **Frontmatter Processing Inconsistencies**:
   - Poems: Frontmatter completely ignored, content extracted via text markers
   - Stories/Thoughts: Use goldmark-meta extension properly
   - Programming: Hardcoded structs with only draft field respected
   - Reviews/Words: Use goldmark-meta as fallback when no frontmatter exists
   - Nature/About: No frontmatter support at all
   - Aphorisms: No markdown processing

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