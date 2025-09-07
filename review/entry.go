package review

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// Extend existing ReviewEntry with Content
type ReviewEntryWithContent struct {
	ReviewEntry
	Content template.HTML
}

func GetEntry(want string) (ReviewEntryWithContent, error) {
	files, err := os.ReadDir("./review")
	if err != nil {
		return ReviewEntryWithContent{}, errors.Wrap(err, "error reading review directory")
	}

	var name string

	for _, dir := range files {
		if n := dir.Name(); strings.HasSuffix(n, fmt.Sprintf("%s.md", want)) {
			name = n
		}
	}

	if name == "" {
		return ReviewEntryWithContent{}, errors.New("not found")
	}

	path := fmt.Sprintf("./review/%s", name)

	file, err := os.ReadFile(path)
	if err != nil {
		return ReviewEntryWithContent{}, errors.Wrapf(err, "error reading review: %s", path)
	}

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, meta.Meta),
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
		return ReviewEntryWithContent{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract metadata
	metaData := meta.Get(context)
	
	// Get content HTML
	contentHTML := buf.String()
	
	// Get title - try metadata first, then extract from content
	var title string
	var titleFromMeta bool
	if t, ok := metaData["title"].(string); ok && t != "" {
		title = t
		titleFromMeta = true
	}
	
	// Check if there's an H1 in content
	if strings.Contains(contentHTML, "<h1") {
		h1Start := strings.Index(contentHTML, "<h1")
		h1StartTag := strings.Index(contentHTML[h1Start:], ">") + h1Start + 1
		h1End := strings.Index(contentHTML, "</h1>")
		
		if h1StartTag > h1Start && h1End > h1StartTag {
			h1Title := contentHTML[h1StartTag:h1End]
			
			// If we got title from metadata, always remove H1 to avoid duplication
			// Also remove if H1 matches the title from metadata
			if titleFromMeta || h1Title == title {
				h1EndTag := h1End + 5 // "</h1>" is 5 chars
				contentHTML = contentHTML[:h1Start] + contentHTML[h1EndTag:]
			} else if title == "" {
				// No title from metadata, use H1 title
				title = h1Title
				// Remove the h1 from content to avoid duplication
				h1EndTag := h1End + 5
				contentHTML = contentHTML[:h1Start] + contentHTML[h1EndTag:]
			}
		}
	}

	// Get date from metadata or use a default
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
		// Pattern: year-month-day or similar
		parts := strings.Split(name, "-")
		if len(parts) >= 3 {
			// Try to parse date from filename
			dateStr := fmt.Sprintf("%s-%s-%s", parts[0], parts[1], parts[2])
			if parsed, err := time.Parse("2006-01-02", dateStr[:10]); err == nil {
				date = parsed
			}
		}
	}

	return ReviewEntryWithContent{
		ReviewEntry: ReviewEntry{
			Title: title,
			Date:  date,
		},
		Content: template.HTML(contentHTML),
	}, nil
}

// Legacy function for backward compatibility
func Entry(want string) ([]byte, error) {
	entry, err := GetEntry(want)
	if err != nil {
		return nil, err
	}
	return []byte(entry.Content), nil
}
