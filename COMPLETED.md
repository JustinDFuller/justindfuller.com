# Completed Website Fixes

This document tracks all completed fixes and resolved issues from the website inventory.

## Recently Completed Pages (Moved from INVENTORY.md)

### Home Page
- **URL**: http://localhost:9000  
- **Status**: ✅ Working properly with footer
- **Completed**: Footer added with responsive visibility

### Main Category Pages (All Working)

#### Stories
- **URL**: http://localhost:9000/story
- **Status**: ✅ Working properly with footer

#### Thoughts  
- **URL**: http://localhost:9000/thought
- **Status**: ✅ Working properly with footer

#### Reviews
- **URL**: http://localhost:9000/review  
- **Status**: ✅ Working properly with footer

#### Programming
- **URL**: http://localhost:9000/programming
- **Status**: ✅ Working properly with footer

#### Words
- **URL**: http://localhost:9000/word
- **Status**: ✅ Working properly with footer
- **Note**: Now uses unified card layout shared with poems and aphorisms

#### About
- **URL**: http://localhost:9000/about
- **Status**: ✅ Working properly with footer

### Additional Pages Found in Footer Navigation

#### Project (Make)
- **URL**: http://localhost:9000/make
- **Status**: ✅ Working properly with footer

#### Nature  
- **URL**: http://localhost:9000/nature
- **Status**: ✅ Working properly with footer
- **Note**: Only one image is a clickable link (Anolis Carolinensis) - by design

### Individual Content Pages (All Working)

#### Story Pages
- **URL Pattern**: /story/{slug}
- **Example**: /story/the_philosophy_of_trees
- **Status**: ✅ Working properly with footer

#### Thought Pages
- **URL Pattern**: /thought/{date-slug}
- **Example**: /thought/2022-02-22-embracing-impostor-syndrome
- **Status**: ✅ Working properly with footer

#### Review Pages
- **URL Pattern**: /review/{slug}
- **Example**: /review/living-on-24-hours-a-day
- **Status**: ✅ Working properly with footer

#### Programming Pages
- **URL Pattern**: /programming/{slug}
- **Example**: /programming/why-do-we-fall-into-the-rewrite-trap
- **Status**: ✅ Working properly with footer

#### Word Pages
- **URL Pattern**: /word/{word}
- **Example**: /word/quality
- **Status**: ✅ Individual pages work properly with footer
- **Note**: Only 2 of 16 words are linked from listing page (separate issue)

## Fixes Applied

### Aphorism Conversion to Markdown (Completed 2025-09-06)
- **Problem**: Aphorisms stored in entries.txt file without frontmatter support
- **Solution**: Converted all 36 aphorisms to individual markdown files with consistent frontmatter
- **Files Modified**:
  - Created aphorism/1.md through aphorism/36.md with frontmatter
  - Updated aphorism/entries.go to read markdown files using goldmark-meta
  - Updated main.go to support individual aphorism routes (/aphorism/1, etc.)
  - Created aphorism/entry.template.html for individual aphorism display
  - Created aphorism/entry.css for individual aphorism styling
- **Result**: 
  - Aphorisms now use consistent markdown format with frontmatter
  - Individual aphorism pages accessible via /aphorism/{number}
  - List page display remains unchanged (no links to individual pages)
  - Original entries.txt preserved for reference

### Nature Page Alignment Fix (Completed)
- **Problem**: Nature page had different header/footer templates and outdated copyright year
- **Solution**: Updated nature/main.html.tmpl to use shared header and footer templates
- **Files Modified**:
  - nature/main.html.tmpl: Replaced custom header/footer with shared templates
- **Result**: Nature page now consistent with rest of site while preserving unique photo grid layout
- **Fixed Issues**:
  - ~~Different header navigation (shows Poems/Stories/Thoughts/Projects instead of GitHub/LinkedIn/Email)~~
  - ~~Has toggle menu button not present on other pages~~
  - ~~Different footer structure and styling~~
  - ~~Footer shows "© 2024" instead of "© 2025" like other pages~~

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

## Resolved Issues

### Content Issues
- **RESOLVED**: "The Philosophy of Lovers" story is marked as draft (intentional - not ready for publication)

### False Positives (Verified as Working)
- **FALSE POSITIVE**: Word headings for Quality and Flexible are actually present (not empty h2 tags)
- **FALSE POSITIVE**: /tags/poetry link exists and returns valid HTML (not broken)
- **FALSE POSITIVE**: Footer links (Aphorism, Project/Make, Nature) ARE visible from homepage in the Explore section

### Design Issues Fixed
- **FIXED**: Nature page has completely different design/navigation
- **FIXED**: Nature page shows "© 2024" while all others show "© 2025"

### MCP Tool Detection Issues (Resolved 2025-09-06)
- **RESOLVED**: Homepage Explore navigation links now properly detected (10 links visible in MCP tool)
- **RESOLVED**: Poem entries on /poem page now properly detected (48 poem articles visible in MCP tool)
- **RESOLVED**: Aphorism entries on /aphorism page now properly detected (36 aphorism articles visible in MCP tool)
- **Note**: These were Browser MCP tool limitations that have been resolved - content was always present in HTML