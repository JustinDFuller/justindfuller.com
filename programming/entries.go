// Package programming handles programming article entries
package programming

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/renderer"
	"github.com/justindfuller/justindfuller.com/syntax"
	"github.com/pkg/errors"
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
			html.WithHardWraps(),
			html.WithUnsafe(),
		),
	)

	var buf bytes.Buffer
	context := parser.NewContext()
	if err := md.Convert(file, &buf, parser.WithContext(context)); err != nil {
		return Entry{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract metadata
	metaData := meta.Get(context)

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
		Content:        template.HTML(buf.String()), //nolint:gosec // Content is from trusted markdown files
		Date:           date,
		IsDraft:        isDraft,
	}, nil
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

// GetEntry retrieves a programming entry by slug
func GetEntry(want string) (Entry, error) {
	files, err := os.ReadDir("./programming")
	if err != nil {
		return Entry{}, errors.Wrap(err, "error reading programming directory")
	}

	for _, file := range files {
		name := file.Name()

		// Skip non-markdown files and directories
		if file.IsDir() || !strings.HasSuffix(name, ".md") {
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

		// Skip non-markdown files and directories
		if file.IsDir() || !strings.HasSuffix(name, ".md") {
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