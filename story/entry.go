package story

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
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

// EntryWithContent extends Entry with HTML content
type EntryWithContent struct {
	Entry
	Content template.HTML
}

// GetEntry retrieves a story entry by slug with full content
func GetEntry(want string) (EntryWithContent, error) {
	files, err := os.ReadDir("./story")
	if err != nil {
		return EntryWithContent{}, errors.Wrap(err, "error reading story directory")
	}

	var name string

	for _, dir := range files {
		if n := dir.Name(); strings.Contains(n, want) && strings.HasSuffix(n, ".md") {
			name = n
		}
	}

	if name == "" {
		return EntryWithContent{}, errors.New("not found")
	}

	path := fmt.Sprintf("./story/%s", name)

	file, err := os.ReadFile(path) //nolint:gosec // Path is sanitized from entries list
	if err != nil {
		return EntryWithContent{}, errors.Wrapf(err, "error reading story: %s", path)
	}

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, meta.Meta, renderer.NewExtension()),
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
		return EntryWithContent{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract metadata
	metaData := meta.Get(context)
	
	// Get content HTML
	contentHTML := buf.String()
	
	// Get title from metadata
	var title string
	if t, ok := metaData["title"].(string); ok && t != "" {
		title = t
	} else {
		// Extract title from first H1 if no metadata
		if strings.Contains(contentHTML, "<h1") {
			start := strings.Index(contentHTML, ">") + 1
			end := strings.Index(contentHTML, "</h1>")
			if start > 0 && end > start {
				title = contentHTML[start:end]
				// Remove the h1 from content to avoid duplication
				h1Start := strings.Index(contentHTML, "<h1")
				h1End := strings.Index(contentHTML, "</h1>") + 5
				if h1Start >= 0 && h1End > h1Start {
					contentHTML = contentHTML[:h1Start] + contentHTML[h1End:]
				}
			}
		}
		// If still no title, format from filename
		if title == "" {
			title = formatTitleFromFilename(name)
		}
	}

	// Get date from metadata or filename
	var date time.Time
	if d, ok := metaData["date"]; ok {
		switch v := d.(type) {
		case time.Time:
			date = v
		case string:
			if parsed, err := time.Parse("2006-01-02", v); err == nil {
				date = parsed
			} else if parsed, err := time.Parse(time.RFC3339, v); err == nil {
				date = parsed
			}
		}
	}
	
	// If no date in metadata, try to parse from filename
	if date.IsZero() {
		// Pattern: 2022-09-18_the_philosophy_of_trees.md
		parts := strings.Split(name, "_")
		if len(parts) > 0 {
			datePart := parts[0]
			if parsed, err := time.Parse("2006-01-02", datePart); err == nil {
				date = parsed
			}
		}
	}

	return EntryWithContent{
		Entry: Entry{
			Title: title,
			Date:  date,
		},
		Content: template.HTML(contentHTML), //nolint:gosec // Content is from trusted markdown files
	}, nil
}

// GetRawEntry returns a story entry as a byte array for backward compatibility
func GetRawEntry(want string) ([]byte, error) {
	entry, err := GetEntry(want)
	if err != nil {
		return nil, err
	}
	return []byte(entry.Content), nil
}

func formatTitleFromFilename(filename string) string {
	// Remove .md extension
	name := strings.TrimSuffix(filename, ".md")
	
	// Remove date prefix if present (e.g., "2022-09-18_")
	if len(name) > 11 && name[10] == '_' {
		name = name[11:]
	}
	
	// Replace underscores with spaces and capitalize words
	parts := strings.Split(name, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}
	
	return strings.Join(parts, " ")
}