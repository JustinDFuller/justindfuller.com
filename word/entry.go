package word

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

type WordEntry struct {
	Title    string
	SubTitle string // Optional subtitle field for compatibility with shared template
	Content  template.HTML
	Date     time.Time
}

func GetEntry(name string) (WordEntry, error) {
	path := fmt.Sprintf("./word/%s.md", name)

	file, err := os.ReadFile(path)
	if err != nil {
		return WordEntry{}, errors.Wrapf(err, "error reading word: %s", path)
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
		return WordEntry{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract metadata
	metaData := meta.Get(context)
	
	// Get content HTML
	contentHTML := buf.String()
	
	// Get title from metadata
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
			
			// If we got title from metadata, remove H1 to avoid duplication
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
	
	// If still no title, format from word name
	if title == "" {
		// Capitalize first letter of each word
		parts := strings.Split(name, "-")
		for i, part := range parts {
			if len(part) > 0 {
				parts[i] = strings.ToUpper(part[:1]) + part[1:]
			}
		}
		title = strings.Join(parts, " ")
	}

	// Get date from metadata
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

	return WordEntry{
		Title:   title,
		Content: template.HTML(contentHTML),
		Date:    date,
	}, nil
}

// Legacy function for backward compatibility
func Entry(name string) ([]byte, error) {
	entry, err := GetEntry(name)
	if err != nil {
		return nil, err
	}
	return []byte(entry.Content), nil
}

// Entries returns the entries.md file split into individual word entries
func Entries() ([][]byte, error) {
	path := "./word/entries.md"
	
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrapf(err, "error reading word entries: %s", path)
	}
	
	// Split by ## (H2 headers) to get individual word entries
	content := string(file)
	parts := strings.Split(content, "\n## ")
	
	entries := make([][]byte, 0)
	for i, part := range parts {
		if strings.TrimSpace(part) == "" {
			continue
		}
		
		// Add back the ## for all parts except the first (which might not have it)
		if i > 0 {
			part = "## " + part
		}
		
		// Remove HR tags since we'll use card layout instead
		part = strings.ReplaceAll(part, "\n<hr />", "")
		part = strings.ReplaceAll(part, "\n<hr/>", "")
		part = strings.ReplaceAll(part, "\n<hr>", "")
		part = strings.TrimSpace(part)
		
		if part != "" && strings.HasPrefix(part, "##") {
			// Convert markdown to HTML for this entry
			md := goldmark.New(
				goldmark.WithExtensions(extension.GFM),
				goldmark.WithParserOptions(
					parser.WithAutoHeadingID(),
				),
				goldmark.WithRendererOptions(
					html.WithHardWraps(),
					html.WithUnsafe(),
				),
			)
			
			var buf bytes.Buffer
			if err := md.Convert([]byte(part), &buf); err != nil {
				return nil, errors.Wrapf(err, "error converting word markdown: %s", part[:min(50, len(part))])
			}
			
			entries = append(entries, buf.Bytes())
		}
	}
	
	return entries, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
