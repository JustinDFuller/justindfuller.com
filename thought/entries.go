// Package thought handles thought/blog entries
package thought

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/renderer"
	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// Entry represents a thought entry with its metadata and content
type Entry struct {
	Title       string
	SubTitle    string // Optional subtitle field for compatibility with shared template
	Slug        string
	Description string
	Content     template.HTML
	Date        time.Time
}

func parseEntry(name string, file []byte) (Entry, error) {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, meta.Meta, renderer.NewExtension()),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
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

	// Extract date from metadata or filename
	var date time.Time
	if d, ok := metaData["date"]; ok {
		switch v := d.(type) {
		case string:
			date, _ = time.Parse("2006-01-02", v)
		case time.Time:
			date = v
		}
	}

	// If no date in metadata, try to extract from filename
	if date.IsZero() && len(name) >= 10 {
		// Try to parse YYYY-MM-DD from beginning of filename
		dateStr := name[:10]
		if strings.Count(dateStr, "-") == 2 {
			date, _ = time.Parse("2006-01-02", dateStr)
		}
	}

	// Generate slug from filename (remove .md extension)
	slug := strings.TrimSuffix(name, ".md")

	// If no title in metadata, generate from filename
	if title == "" {
		// Remove date prefix and .md suffix
		title = name
		if strings.Contains(title, "-") {
			parts := strings.SplitN(title, "-", 4)
			if len(parts) >= 4 {
				// Remove YYYY-MM-DD prefix
				title = parts[3]
			}
		}
		title = strings.TrimSuffix(title, ".md")
		title = strings.ReplaceAll(title, "-", " ")
		title = strings.ReplaceAll(title, "_", " ")
	}

	// Extract first paragraph as description
	description := ""
	contentStr := buf.String()
	// Look for first paragraph after any headers
	lines := strings.Split(contentStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "<h") && !strings.HasPrefix(line, "<!--") && !strings.HasPrefix(line, "<span") {
			// Strip HTML tags for description
			line = strings.ReplaceAll(line, "<p>", "")
			line = strings.ReplaceAll(line, "</p>", "")
			line = strings.ReplaceAll(line, "<em>", "")
			line = strings.ReplaceAll(line, "</em>", "")
			line = strings.ReplaceAll(line, "<strong>", "")
			line = strings.ReplaceAll(line, "</strong>", "")
			line = strings.ReplaceAll(line, "<span>", "")
			line = strings.ReplaceAll(line, "</span>", "")
			line = strings.ReplaceAll(line, `<span class="story">`, "")
			if len(line) > 200 {
				description = line[:197] + "..."
			} else {
				description = line
			}
			break
		}
	}

	return Entry{
		Title:       title,
		SubTitle:    subTitle,
		Slug:        slug,
		Description: description,
		Content:     template.HTML(buf.Bytes()), //nolint:gosec // Content is from trusted markdown files
		Date:        date,
	}, nil
}

// GetEntry retrieves a thought entry by slug
func GetEntry(want string) (Entry, error) {
	files, err := os.ReadDir("./thought")
	if err != nil {
		return Entry{}, errors.Wrap(err, "error reading thought directory")
	}

	var name string

	for _, dir := range files {
		if n := dir.Name(); strings.HasSuffix(n, fmt.Sprintf("%s.md", want)) {
			name = n
		}
	}

	if name == "" {
		return Entry{}, errors.New("not found")
	}

	path := fmt.Sprintf("./thought/%s", name)

	file, err := os.ReadFile(path) //nolint:gosec // Path is from entries list
	if err != nil {
		return Entry{}, errors.Wrapf(err, "error reading thought entry: %s", path)
	}

	return parseEntry(name, file)
}

// GetEntries returns all thought entries sorted by date
func GetEntries() ([]Entry, error) {
	files, err := os.ReadDir("./thought")
	if err != nil {
		return nil, errors.Wrap(err, "error reading thought directory")
	}

	entries := make([]Entry, 0, len(files))

	for _, dir := range files {
		name := dir.Name()

		// Skip non-markdown files and directories
		if dir.IsDir() || !strings.HasSuffix(name, ".md") {
			continue
		}

		// Skip template files
		if strings.Contains(name, "template") {
			continue
		}

		path := fmt.Sprintf("./thought/%s", name)
		file, err := os.ReadFile(path) //nolint:gosec // Path is from filtered directory listing
		if err != nil {
			continue // Skip files we can't read
		}

		entry, err := parseEntry(name, file)
		if err != nil {
			continue // Skip files we can't parse
		}

		entries = append(entries, entry)
	}

	// Sort by date, newest first
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})

	return entries, nil
}

// GetEntryContent keeps backward compatibility with the old Entry function
func GetEntryContent(want string) ([]byte, error) {
	entry, err := GetEntry(want)
	if err != nil {
		return nil, err
	}
	return []byte(entry.Content), nil
}
