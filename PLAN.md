# Website Design Update Plan

## Objective
Update all pages on justindfuller.com to match the new Josh W. Comeau-inspired dark theme design system, ensuring consistency across all routes defined in app.yaml.

## Design System Reference
- Following design-system.md specifications
- Dark theme with pink/yellow accents
- Wotfard font family
- Consistent header/footer across all pages
- CSS variables for maintainability

## Progress Completed ✅

### 1. Analysis Phase
- ✅ Analyzed all routes in app.yaml
- ✅ Identified pages needing updates
- ✅ Confirmed correct pages: home (/), /poem, /aphorism

### 2. Fixed Entry Templates and CSS
These entry templates were including conflicting CSS that overrode the main design:

- ✅ **Story entries** 
  - Updated story/story.css to complement (not conflict) with main design
  - Updated story/story.template.html with proper header/footer/navigation
  
- ✅ **Word entries**
  - Updated word/entry.css to use CSS variables from main design
  - Updated word/entry.template.html with proper structure
  
- ✅ **Thought entries**
  - Updated thought/entry.css to complement main design
  - Updated thought/entry.template.html with navigation
  
- ✅ **Review entries**
  - Updated review/review.css to use design system variables
  - Updated review/review.template.html with proper layout

### 3. Key Changes Made
- Replaced hardcoded colors/fonts with CSS variables
- Added `.story-content`, `.word-content`, `.thought-content`, `.review-content` wrapper classes
- Added back navigation links to parent pages
- Included consistent header/footer on all entry pages
- Removed conflicting base styles (Amiri font, light backgrounds)

## Remaining TODOs 📝

### 1. Nature Entry CSS
- ❓ Check if nature/entry.css needs updating (no template found, may not be used)

### 2. Build and Verify
- ✅ Run `make build` to rebuild all static pages
- ✅ Verify all routes load correctly with new design (thought, story, word entries confirmed)
- [ ] Test responsive design on mobile/tablet breakpoints

### 3. Special Pages
These appear to be interactive applications with intentionally different designs:
- /grass (Grass app with own design)
- /kit (Kit game with own design)  
- /avatar (Avatar generator with own design)
- /weeks-remaining (Weeks remaining app with own design)

**Decision needed**: Should these special interactive pages keep their unique designs or be updated to match?

### 4. Testing Checklist
- ✅ Home page loads correctly
- ✅ All list pages (poem, story, review, etc.) have consistent design
- ✅ All entry pages have proper navigation and styling
- [ ] Mobile responsive design works
- ✅ Dark theme gradient background displays correctly
- ✅ Fonts load properly (Wotfard)
- ✅ Navigation hover effects work
- ✅ Footer displays on all pages

## Technical Notes

### Issue Found
Entry templates were including both `/main.css` (new design) and their own CSS files with conflicting base styles. This caused:
- Wrong fonts (Amiri instead of Wotfard)
- Wrong colors (light theme instead of dark)
- Missing navigation elements

### Solution Applied
- Keep `/main.css` for base design system
- Update entry CSS files to only add complementary styles
- Use CSS variables from main design system
- Add proper HTML structure with header/navigation/footer

### Files Modified
- story/story.css
- story/story.template.html
- word/entry.css
- word/entry.template.html
- thought/entry.css
- thought/entry.template.html
- review/review.css
- review/review.template.html

## Next Steps
1. Complete rebuild with `make build`
2. Test all routes systematically
3. Fix any remaining issues
4. Consider whether to update special interactive pages
5. Final review and commit