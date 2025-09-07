# Frontmatter Migration Plan

## Overview
Convert reviews, words, nature, and about categories to use frontmatter consistently with other content types. This plan adds frontmatter to existing files without creating new content or changing URLs.

## Migration Scope

### 1. Reviews Category (5 files)
**Current State:** No frontmatter, hardcoded entries in `entries_list.go`, uses H1 for title extraction

**Files to Update:**
- `review/walden.md`
- `review/howards-end.md` 
- `review/zen-and-the-art-of-motorcycle-maintenance.md`
- `review/living-on-24-hours-a-day.md`
- `review/the-history-of-modern-political-philosophy.md`

**Frontmatter to Add:**
```yaml
---
title: [Extract from H1 in file]
date: [Use existing dates from entries_list.go]
author: Justin Fuller
category: review
tags: [review]
---
```

**Specific Values:**
- walden.md: `title: "Walden"`, `date: 2021-05-15`
- howards-end.md: `title: "Howards End"`, `date: 2021-08-28`
- zen-and-the-art-of-motorcycle-maintenance.md: `title: "Zen and the Art of Motorcycle Maintenance"`, `date: 2022-04-14`
- living-on-24-hours-a-day.md: `title: "Living on 24 Hours a Day"`, `date: 2022-01-07`
- the-history-of-modern-political-philosophy.md: `title: "The History of Modern Political Philosophy"`, `date: 2024-12-15`

**Go Code Changes:**
- Modify `review/entry.go` to extract frontmatter fields (title, date)
- Update `review/entries_list.go` to dynamically read markdown files instead of hardcoded entries
- Ensure slug generation matches existing slugs (kebab-case from filename)

### 2. Words Category (4 files)
**Current State:** No frontmatter, uses H1 for title extraction

**Files to Update:**
- `word/flexible.md`
- `word/quality.md`
- `word/equipoise.md`
- `word/entries.md`

**Frontmatter to Add:**
```yaml
---
title: [Extract from H1 in file]
date: 2025-09-07
author: Justin Fuller
category: word
tags: [word]
---
```

**Specific Values:**
- flexible.md: `title: "Flexible"`
- quality.md: `title: "Quality"`
- equipoise.md: `title: "Equipoise"`
- entries.md: `title: "Entries"` (or check if this should be excluded)

**Go Code Changes:**
- Update `word/entry.go` to extract frontmatter fields
- Ensure the existing dynamic file reading continues to work
- Maintain existing slug generation from filename

### 3. Nature Category (1 file)
**Current State:** Hardcoded entry in Go code, markdown file exists but frontmatter not utilized

**Files to Update:**
- `nature/anolis-carolinensis.md`

**Frontmatter to Add:**
```yaml
---
title: "Anolis Carolinensis"
subtitle: "Carolina Anole"
date: 2025-09-07
author: Justin Fuller
category: nature
tags: [nature]
---
```

**Go Code Changes:**
- Modify `nature/entry.go` to extract frontmatter instead of using hardcoded entries
- Remove hardCodedEntries array
- Update to dynamically read markdown files with frontmatter
- Maintain existing slug generation pattern

### 4. About Category (1 file)
**Current State:** Single markdown file, no frontmatter used

**Files to Update:**
- `about/about.md`

**Frontmatter to Add:**
```yaml
---
title: "About"
date: 2025-09-07
author: Justin Fuller
category: about
tags: [about]
---
```

**Go Code Changes:**
- Update `about/entries.go` to extract frontmatter if it processes markdown
- Ensure the about page continues to render correctly

## Implementation Steps

### Phase 1: Add Frontmatter to Files
1. Add frontmatter to all review markdown files (5 files)
2. Add frontmatter to all word markdown files (4 files)
3. Add frontmatter to nature markdown file (1 file)
4. Add frontmatter to about markdown file (1 file)

### Phase 2: Update Go Processing Code
1. **Review Category:**
   - Update `review/entry.go` to use goldmark-meta for frontmatter extraction
   - Modify `review/entries_list.go` to dynamically read files instead of hardcoded list
   - Ensure dates and titles match existing values

2. **Word Category:**
   - Ensure `word/entry.go` properly extracts title from frontmatter
   - Verify fallback to H1 still works if needed

3. **Nature Category:**
   - Refactor `nature/entry.go` to read frontmatter
   - Remove hardCodedEntries initialization
   - Implement dynamic file reading similar to other categories

4. **About Category:**
   - Update `about/entries.go` if needed to utilize frontmatter

### Phase 3: Testing & Validation
1. Verify all pages load correctly at existing URLs
2. Confirm titles and dates display properly
3. Test that content renders without issues
4. Ensure no broken links or missing content

## Important Constraints
- **NO new content creation** - only add frontmatter metadata
- **Preserve existing URLs** - slugs must match current routing
- **Use existing data** - dates from hardcoded entries, titles from H1 tags
- **Author always "Justin Fuller"**
- **Default date: 2025-09-07** where no date exists
- **No new fields** - only standard fields: title, date, author, category, tags (and subtitle for nature)
- **Category and tags** - use the existing category name (review→review, word→word, nature→nature, about→about)

## Success Criteria
- All markdown files have consistent frontmatter
- Go code processes frontmatter instead of hardcoded values
- Existing URLs continue to work
- No visual changes to the website
- Code follows patterns from already-migrated categories (thoughts, programming, stories)

## Risk Mitigation
- Test each category individually before moving to the next
- Keep backups of original files
- Verify rendering at each step
- Maintain backward compatibility during transition