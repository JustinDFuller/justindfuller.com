// Package programming handles programming article entries
package programming

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/renderer"
	"github.com/justindfuller/justindfuller.com/syntax"
	"github.com/pkg/errors"
	"github.com/pmezard/go-difflib/difflib"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// Entry represents a programming article with its metadata
type Entry struct {
	Title          string
	SubTitle       string // Optional subtitle field for compatibility with shared template
	Slug           string
	Description    string
	FirstParagraph string
	Content        template.HTML
	Date           time.Time
	IsDraft        bool
	EditorPage     *EditorPage
}

// EditorPage is the template-facing comparison content for an editor-types post.
type EditorPage struct {
	Before   template.HTML
	After    template.HTML
	Variants []EditorVariant
}

// EditorVariant is one editor's prompt, response, and optional source diff.
type EditorVariant struct {
	AnchorID string
	Name     string
	Position int
	Prompt   template.HTML
	Response template.HTML
	Diff     []DiffHunk
}

// DiffHunk and DiffRow model a unified, line-numbered source diff.
type DiffHunk struct {
	OldStart int
	OldLines int
	NewStart int
	NewLines int
	Rows     []DiffRow
}

type DiffRow struct {
	Kind     string
	OldLine  int
	NewLine  int
	Segments []ChangedSegment
}

// ChangedSegment is safely escaped diff text with an optional changed-span marker.
type ChangedSegment struct {
	Text    template.HTML
	Changed bool
}

// parseEntryMetadata parses only the metadata from a markdown file without rendering content
func parseEntryMetadata(name string, file []byte) Entry {
	// Parse frontmatter
	lines := strings.Split(string(file), "\n")
	metaData := make(map[string]interface{})

	if len(lines) > 0 && strings.TrimSpace(lines[0]) == "---" {
		var metaLines []string
		for i := 1; i < len(lines); i++ {
			if strings.TrimSpace(lines[i]) == "---" {
				break
			}
			metaLines = append(metaLines, lines[i])
		}

		// Simple frontmatter parsing
		for _, line := range metaLines {
			if strings.Contains(line, ":") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					value := strings.TrimSpace(parts[1])
					value = strings.Trim(value, `"`)

					switch key {
					case "title":
						metaData["title"] = value
					case "subtitle":
						metaData["subtitle"] = value
					case "description":
						metaData["description"] = value
					case "date":
						metaData["date"] = value
					case "draft":
						metaData["draft"] = value == "true"
					}
				}
			}
		}
	}

	// Extract title from metadata
	title := ""
	if t, ok := metaData["title"]; ok {
		if titleStr, ok := t.(string); ok {
			title = titleStr
		}
	}

	// Extract subtitle from metadata
	subTitle := ""
	if s, ok := metaData["subtitle"]; ok {
		if subStr, ok := s.(string); ok {
			subTitle = subStr
		}
	}

	// Extract description from metadata
	description := ""
	if d, ok := metaData["description"]; ok {
		if descStr, ok := d.(string); ok {
			description = descStr
		}
	}

	// Extract date from metadata or filename
	var date time.Time
	if d, ok := metaData["date"]; ok {
		if dateStr, ok := d.(string); ok {
			date, _ = time.Parse("2006-01-02", dateStr)
			if date.IsZero() {
				// Try parsing as just year
				if year, err := time.Parse("2006", dateStr); err == nil {
					date = year
				}
			}
		}
	}

	// If no date in metadata, try to extract from filename
	if date.IsZero() && len(name) >= 10 {
		// Try to parse YYYY-MM-DD from beginning of filename
		dateStr := name[:10]
		if strings.Count(dateStr, "-") == 2 || strings.Count(dateStr, "_") == 2 {
			// Replace underscores with dashes for parsing
			dateStr = strings.ReplaceAll(dateStr, "_", "-")
			date, _ = time.Parse("2006-01-02", dateStr)
		}
	}

	// Check if draft is set to true in metadata
	isDraft := false
	if draft, ok := metaData["draft"]; ok {
		if draftBool, ok := draft.(bool); ok {
			isDraft = draftBool
		}
	}

	// Generate slug from filename (remove .md extension and date prefix)
	slug := strings.TrimSuffix(name, ".md")
	// Remove date prefix if present (YYYY-MM-DD_ or YYYY-MM-DD-)
	if len(slug) > 11 && (slug[10] == '_' || slug[10] == '-') {
		slug = slug[11:]
	}
	// Replace underscores with dashes for consistency
	slug = strings.ReplaceAll(slug, "_", "-")

	// If no title in metadata, generate from slug
	if title == "" {
		title = strings.ReplaceAll(slug, "-", " ")
		title = cases.Title(language.English).String(title)
	}

	// Extract first paragraph if no description provided
	if description == "" {
		description = extractFirstParagraph(string(file))
	}

	// Also set FirstParagraph for compatibility
	firstParagraph := extractFirstParagraph(string(file))

	return Entry{
		Title:          title,
		SubTitle:       subTitle,
		Slug:           slug,
		Description:    description,
		FirstParagraph: firstParagraph,
		Content:        "", // Don't render content for metadata-only parsing
		Date:           date,
		IsDraft:        isDraft,
	}
}

func parseEntry(name string, file []byte) (Entry, error) {
	content, context, err := renderMarkdown(file)
	if err != nil {
		return Entry{}, err
	}

	return entryFromMetadata(name, file, content, meta.Get(context)), nil
}

func renderMarkdown(source []byte) (template.HTML, parser.Context, error) {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			meta.Meta,
			syntax.GetHighlighting(),
			renderer.NewExtension(),
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithUnsafe(),
		),
	)

	var buf bytes.Buffer
	context := parser.NewContext()
	if err := md.Convert(source, &buf, parser.WithContext(context)); err != nil {
		return "", nil, errors.Wrap(err, "error converting markdown")
	}
	return template.HTML(buf.String()), context, nil //nolint:gosec // Content is from trusted markdown files
}

func entryFromMetadata(name string, file []byte, content template.HTML, metaData map[string]interface{}) Entry {

	// Extract metadata

	// Extract title from metadata
	title := ""
	if t, ok := metaData["title"]; ok {
		if titleStr, ok := t.(string); ok {
			title = titleStr
		}
	}

	// Extract subtitle from metadata
	subTitle := ""
	if s, ok := metaData["subtitle"]; ok {
		if subStr, ok := s.(string); ok {
			subTitle = subStr
		}
	}

	// Extract description from metadata
	description := ""
	if d, ok := metaData["description"]; ok {
		if descStr, ok := d.(string); ok {
			description = descStr
		}
	}

	// Extract date from metadata or filename
	var date time.Time
	if d, ok := metaData["date"]; ok {
		switch v := d.(type) {
		case string:
			date, _ = time.Parse("2006-01-02", v)
		case time.Time:
			date = v
		case int:
			// Handle year-only dates
			date = time.Date(v, 1, 1, 0, 0, 0, 0, time.UTC)
		case float64:
			// Handle year-only dates as float
			date = time.Date(int(v), 1, 1, 0, 0, 0, 0, time.UTC)
		}
	}

	// If no date in metadata, try to extract from filename
	if date.IsZero() && len(name) >= 10 {
		// Try to parse YYYY-MM-DD from beginning of filename
		dateStr := name[:10]
		if strings.Count(dateStr, "-") == 2 || strings.Count(dateStr, "_") == 2 {
			// Replace underscores with dashes for parsing
			dateStr = strings.ReplaceAll(dateStr, "_", "-")
			date, _ = time.Parse("2006-01-02", dateStr)
		}
	}

	// Check if draft is set to true in metadata
	isDraft := false
	if draft, ok := metaData["draft"]; ok {
		if draftBool, ok := draft.(bool); ok {
			isDraft = draftBool
		}
	}

	// Generate slug from filename (remove .md extension and date prefix)
	slug := strings.TrimSuffix(name, ".md")
	// Remove date prefix if present (YYYY-MM-DD_ or YYYY-MM-DD-)
	if len(slug) > 11 && (slug[10] == '_' || slug[10] == '-') {
		slug = slug[11:]
	}
	// Replace underscores with dashes for consistency
	slug = strings.ReplaceAll(slug, "_", "-")

	// If no title in metadata, generate from slug
	if title == "" {
		title = strings.ReplaceAll(slug, "-", " ")
		title = cases.Title(language.English).String(title)
	}

	// Extract first paragraph if no description provided
	if description == "" {
		description = extractFirstParagraph(string(file))
	}

	// Also set FirstParagraph for compatibility
	firstParagraph := extractFirstParagraph(string(file))

	return Entry{
		Title:          title,
		SubTitle:       subTitle,
		Slug:           slug,
		Description:    description,
		FirstParagraph: firstParagraph,
		Content:        content,
		Date:           date,
		IsDraft:        isDraft,
	}
}

func extractFirstParagraph(markdown string) string {
	// Remove frontmatter if present
	lines := strings.Split(markdown, "\n")
	start := 0
	if len(lines) > 0 && strings.TrimSpace(lines[0]) == "---" {
		for i := 1; i < len(lines); i++ {
			if strings.TrimSpace(lines[i]) == "---" {
				start = i + 1
				break
			}
		}
	}

	// Join remaining lines
	content := strings.Join(lines[start:], "\n")

	// Remove headers and find first non-empty paragraph
	paragraphs := strings.Split(content, "\n\n")
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		// Skip empty lines, headers, code blocks, and HTML comments
		if p == "" || strings.HasPrefix(p, "#") || strings.HasPrefix(p, "```") || strings.HasPrefix(p, "<!--") {
			continue
		}
		// Remove any markdown formatting but keep the text
		p = regexp.MustCompile(`\[([^\]]+)\]\([^\)]+\)`).ReplaceAllString(p, "$1")     // Links
		p = regexp.MustCompile(`[*_]{1,2}([^*_]+)[*_]{1,2}`).ReplaceAllString(p, "$1") // Bold/italic
		p = regexp.MustCompile(`^[-*+] `).ReplaceAllString(p, "")                      // List markers
		p = strings.TrimSpace(p)
		if p != "" {
			// Truncate if too long
			if len(p) > 200 {
				return p[:197] + "..."
			}
			return p
		}
	}
	return ""
}

const placementMarker = "<!--PlaceVariantsHere-->"

var variantName = regexp.MustCompile(`^([1-9][0-9]*)-(.+)\.md$`)
var sectionMarker = regexp.MustCompile(`(?m)^<!--\s*(Prompt|PlainTextResponse|EditedCopy)\s*-->\s*$`)
var diffToken = regexp.MustCompile(`\s+|[\pL\pN_]+|[^\s\pL\pN_]`)

func parseEditorPage(directory string, post []byte) (*EditorPage, error) {
	if strings.Count(string(post), placementMarker) != 1 {
		return nil, errors.New("editor post must contain exactly one PlaceVariantsHere marker")
	}
	parts := strings.Split(string(post), placementMarker)
	before, _, err := renderMarkdown([]byte(parts[0]))
	if err != nil {
		return nil, err
	}
	after, _, err := renderMarkdown([]byte(parts[1]))
	if err != nil {
		return nil, err
	}

	original, err := os.ReadFile(directory + "/0-original-copy.md")
	if err != nil {
		return nil, errors.Wrap(err, "reading editor original copy")
	}
	files, err := os.ReadDir(directory)
	if err != nil {
		return nil, errors.Wrap(err, "reading editor variants")
	}
	type numberedVariant struct {
		order   int
		variant EditorVariant
	}
	variants := make([]numberedVariant, 0)
	for _, file := range files {
		matches := variantName.FindStringSubmatch(file.Name())
		if file.IsDir() || matches == nil {
			continue
		}
		order, _ := strconv.Atoi(matches[1])
		body, readErr := os.ReadFile(directory + "/" + file.Name())
		if readErr != nil {
			return nil, errors.Wrap(readErr, "reading editor variant")
		}
		variant, parseErr := parseEditorVariant(matches[2], body, original)
		if parseErr != nil {
			return nil, errors.Wrapf(parseErr, "parsing editor variant %s", file.Name())
		}
		variant.AnchorID = editorVariantAnchorID(matches[2])
		variants = append(variants, numberedVariant{order: order, variant: variant})
	}
	sort.Slice(variants, func(i, j int) bool {
		return variants[i].order < variants[j].order
	})

	page := &EditorPage{Before: before, After: after, Variants: make([]EditorVariant, len(variants))}
	anchorIDs := make(map[string]struct{}, len(variants))
	for i, numbered := range variants {
		if _, exists := anchorIDs[numbered.variant.AnchorID]; exists {
			return nil, errors.Errorf("editor variant anchor ID %q is not unique", numbered.variant.AnchorID)
		}
		anchorIDs[numbered.variant.AnchorID] = struct{}{}
		numbered.variant.Position = i + 1
		page.Variants[i] = numbered.variant
	}
	return page, nil
}

func editorVariantAnchorID(filename string) string {
	anchor := strings.ToLower(filename)
	anchor = strings.ReplaceAll(anchor, "_", "-")
	anchor = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(anchor, "-")
	return "editor-variant-" + strings.Trim(anchor, "-")
}

func parseEditorVariant(filename string, source, original []byte) (EditorVariant, error) {
	matches := sectionMarker.FindAllStringSubmatchIndex(string(source), -1)
	if len(matches) < 2 || len(matches) > 3 {
		return EditorVariant{}, errors.New("variant must contain Prompt, PlainTextResponse, and optional EditedCopy exactly once")
	}
	sections := make(map[string]string, len(matches))
	previous := ""
	for i, match := range matches {
		name := string(source[match[2]:match[3]])
		if (i == 0 && name != "Prompt") || (i == 1 && name != "PlainTextResponse") || (i == 2 && name != "EditedCopy") || name == previous {
			return EditorVariant{}, errors.New("variant sections are missing, duplicated, or out of order")
		}
		end := len(source)
		if i+1 < len(matches) {
			end = matches[i+1][0]
		}
		sections[name] = strings.TrimSpace(string(source[match[1]:end]))
		previous = name
	}
	if sections["Prompt"] == "" || sections["PlainTextResponse"] == "" {
		return EditorVariant{}, errors.New("Prompt and PlainTextResponse must not be empty")
	}
	prompt, _, err := renderMarkdown([]byte(sections["Prompt"]))
	if err != nil {
		return EditorVariant{}, err
	}
	response, _, err := renderMarkdown([]byte(sections["PlainTextResponse"]))
	if err != nil {
		return EditorVariant{}, err
	}
	variant := EditorVariant{Name: displayName(filename), Prompt: prompt, Response: response}
	if edited := sections["EditedCopy"]; edited != "" {
		variant.Diff = buildDiff(string(original), edited)
	}
	return variant, nil
}

func displayName(value string) string {
	value = strings.ReplaceAll(value, "-", " ")
	value = strings.ReplaceAll(value, "_", " ")
	return cases.Title(language.English).String(value)
}

func buildDiff(original, edited string) []DiffHunk {
	a, b := strings.Split(original, "\n"), strings.Split(edited, "\n")
	matcher := difflib.NewMatcher(a, b)
	groups := matcher.GetGroupedOpCodes(3)
	if len(groups) == 0 {
		return nil
	}
	hunks := make([]DiffHunk, 0, len(groups))
	for _, group := range groups {
		first, last := group[0], group[len(group)-1]
		hunk := DiffHunk{OldStart: first.I1 + 1, OldLines: last.I2 - first.I1, NewStart: first.J1 + 1, NewLines: last.J2 - first.J1}
		for _, op := range group {
			switch op.Tag {
			case 'e':
				for i := 0; i < op.I2-op.I1; i++ {
					hunk.Rows = append(hunk.Rows, plainDiffRow("context", op.I1+i+1, op.J1+i+1, a[op.I1+i]))
				}
			case 'd':
				for i := op.I1; i < op.I2; i++ {
					hunk.Rows = append(hunk.Rows, plainDiffRow("delete", i+1, 0, a[i]))
				}
			case 'i':
				for j := op.J1; j < op.J2; j++ {
					hunk.Rows = append(hunk.Rows, plainDiffRow("insert", 0, j+1, b[j]))
				}
			case 'r':
				oldCount, newCount := op.I2-op.I1, op.J2-op.J1
				paired := min(oldCount, newCount)
				for i := 0; i < paired; i++ {
					old, added := changedLineSegments(a[op.I1+i], b[op.J1+i])
					hunk.Rows = append(hunk.Rows, DiffRow{Kind: "delete", OldLine: op.I1 + i + 1, Segments: old}, DiffRow{Kind: "insert", NewLine: op.J1 + i + 1, Segments: added})
				}
				for i := paired; i < oldCount; i++ {
					hunk.Rows = append(hunk.Rows, plainDiffRow("delete", op.I1+i+1, 0, a[op.I1+i]))
				}
				for j := paired; j < newCount; j++ {
					hunk.Rows = append(hunk.Rows, plainDiffRow("insert", 0, op.J1+j+1, b[op.J1+j]))
				}
			}
		}
		hunks = append(hunks, hunk)
	}
	return hunks
}

func plainDiffRow(kind string, oldLine, newLine int, value string) DiffRow {
	return DiffRow{Kind: kind, OldLine: oldLine, NewLine: newLine, Segments: []ChangedSegment{{Text: escapedDiff(value)}}}
}

func changedLineSegments(old, added string) ([]ChangedSegment, []ChangedSegment) {
	a, b := diffToken.FindAllString(old, -1), diffToken.FindAllString(added, -1)
	matcher := difflib.NewMatcher(a, b)
	oldSegments, newSegments := []ChangedSegment{}, []ChangedSegment{}
	for _, op := range matcher.GetOpCodes() {
		for i := op.I1; i < op.I2; i++ {
			oldSegments = append(oldSegments, ChangedSegment{Text: escapedDiff(a[i]), Changed: op.Tag != 'e'})
		}
		for j := op.J1; j < op.J2; j++ {
			newSegments = append(newSegments, ChangedSegment{Text: escapedDiff(b[j]), Changed: op.Tag != 'e'})
		}
	}
	return oldSegments, newSegments
}

func escapedDiff(value string) template.HTML {
	return template.HTML(template.HTMLEscapeString(value)) //nolint:gosec // Escaped before trusted template rendering
}

// GetEntry retrieves a programming entry by slug
func GetEntry(want string) (Entry, error) {
	files, err := os.ReadDir("./programming")
	if err != nil {
		return Entry{}, errors.Wrap(err, "error reading programming directory")
	}

	for _, file := range files {
		name := file.Name()

		if file.IsDir() {
			postPath := fmt.Sprintf("./programming/%s/post.md", name)
			content, readErr := os.ReadFile(postPath)
			if readErr != nil {
				continue
			}
			entry, parseErr := parseEntry(name+".md", content)
			if parseErr != nil || entry.Slug != want {
				continue
			}
			page, pageErr := parseEditorPage(fmt.Sprintf("./programming/%s", name), content)
			if pageErr != nil {
				return Entry{}, pageErr
			}
			entry.EditorPage = page
			return entry, nil
		}

		// Skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			continue
		}

		// Skip template files
		if strings.Contains(name, "template") {
			continue
		}

		path := fmt.Sprintf("./programming/%s", name)
		content, err := os.ReadFile(path) //nolint:gosec // Path is from filtered directory listing
		if err != nil {
			continue
		}

		entry, err := parseEntry(name, content)
		if err != nil {
			continue
		}

		// Check if this is the entry we want
		if entry.Slug == want {
			return entry, nil
		}
	}

	return Entry{}, errors.New("programming entry not found")
}

// GetEntries returns all programming entries sorted by date (newest first)
// This version only parses metadata for better performance on list views
func GetEntries() ([]Entry, error) {
	files, err := os.ReadDir("./programming")
	if err != nil {
		return nil, errors.Wrap(err, "error reading programming directory")
	}

	entries := make([]Entry, 0, len(files))

	for _, file := range files {
		name := file.Name()

		if file.IsDir() {
			content, readErr := os.ReadFile(fmt.Sprintf("./programming/%s/post.md", name))
			if readErr != nil {
				continue
			}
			entry := parseEntryMetadata(name+".md", content)
			if !entry.IsDraft {
				entries = append(entries, entry)
			}
			continue
		}

		// Skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			continue
		}

		// Skip template files
		if strings.Contains(name, "template") {
			continue
		}

		path := fmt.Sprintf("./programming/%s", name)
		content, err := os.ReadFile(path) //nolint:gosec // Path is from filtered directory listing
		if err != nil {
			continue // Skip files we can't read
		}

		// Use lightweight metadata parsing for list views
		entry := parseEntryMetadata(name, content)

		// Only include non-draft entries
		if !entry.IsDraft {
			entries = append(entries, entry)
		}
	}

	// Sort by date, newest first
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})

	return entries, nil
}

// Entries is a cached list of all non-draft entries.
// Deprecated: Use GetEntries() instead for dynamic loading.
var Entries []Entry

func init() {
	// Load entries on initialization for backward compatibility
	if entries, err := GetEntries(); err == nil {
		Entries = entries
	}
}
