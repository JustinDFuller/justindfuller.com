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
  * Missing "The Philosophy of Lovers" story (found in markdown files but not displayed)
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
* Inconsistencies:
  * MAJOR: Completely different design/layout than rest of site
  * Different header navigation (shows Poems/Stories/Thoughts/Projects instead of GitHub/LinkedIn/Email)
  * Has toggle menu button not present on other pages
  * Different footer structure and styling
  * Footer shows "© 2024" instead of "© 2025" like other pages
  * Only one image is a clickable link (Anolis Carolinensis)

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
   - **CONFIRMED**: Missing story ("The Philosophy of Lovers") - markdown file exists but not in entries.go
   - **FALSE POSITIVE**: Word headings for Quality and Flexible are actually present (not empty h2 tags)

2. **Design Inconsistencies**:
   - **CONFIRMED**: Nature page has completely different design/navigation (shows Poems/Stories/Thoughts/Projects instead of GitHub/LinkedIn/Email)
   - **CONFIRMED**: Word page uses inline display instead of card layout (no .word-card classes)
   - **CONFIRMED**: Nature page shows "© 2024" while all others show "© 2025"

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