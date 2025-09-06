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

1. **Critical Functionality Issues**:
   - **Browser MCP Tool Detection Issues** (potential accessibility concern):
     - Homepage Explore navigation links not detected (present in HTML)
     - Poem entries on /poem page not detected (present in HTML)
     - Aphorism entries on /aphorism page not detected (present in HTML)
     - **UPDATE**: Removed JavaScript font loading (was using visibility:hidden) and implemented font-display:swap, but Browser MCP tool still cannot detect content. Issue appears to be deeper than font loading.

2. **Design Inconsistencies**:
   - Nature page has completely different design/navigation
   - Word page uses inline display instead of card layout

3. **Content Issues**:
   - Missing story ("The Philosophy of Lovers") on listing page
   - Two word entries missing headings (Quality, Flexible)

4. **Navigation Issues**:
   - Footer links to sections not visible from homepage (Aphorism, Project/Make, Nature)
   - Broken link to /tags/poetry in Thought section
   - Nature page has different header navigation

5. **Date Inconsistency**:
   - Nature page shows "© 2024" while all others show "© 2025"

## Fixes Applied

### Font Loading Accessibility Fix (Completed)
- **Problem**: JavaScript was hiding content with `visibility: hidden` during font loading
- **Solution**: Removed all font loading JavaScript and rely on CSS `font-display: swap`
- **Files Modified**:
  - Emptied 13 JavaScript files (main.js, poem/main.js, aphorism/main.js, etc.)
  - Removed script includes from 14 template files
- **Result**: Content now always visible (with brief font swap flash), but Browser MCP tool still cannot detect content
- **Conclusion**: The accessibility issue is deeper than font loading - may be a Browser MCP tool limitation or other rendering issue