package review

import (
	"bytes"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

type ReviewEntry struct {
	Title          string
	SubTitle       string // Optional subtitle field for compatibility with shared template
	Slug           string
	FirstParagraph string
	Date           time.Time
}

func extractFirstParagraph(content string) string {
	// Remove frontmatter if present
	lines := strings.Split(content, "\n")
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
	text := strings.Join(lines[start:], "\n")
	
	// Remove headers and find first non-empty paragraph
	paragraphs := strings.Split(text, "\n\n")
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		// Skip empty lines, headers, code blocks, images, and centered text
		if p == "" || strings.HasPrefix(p, "#") || strings.HasPrefix(p, "```") || 
		   strings.HasPrefix(p, "<img") || strings.HasPrefix(p, "<p align") ||
		   strings.HasPrefix(p, "![") || strings.HasPrefix(p, ">") {
			continue
		}
		// Remove any markdown formatting but keep the text
		p = regexp.MustCompile(`\[([^\]]+)\]\([^\)]+\)`).ReplaceAllString(p, "$1") // Links
		p = regexp.MustCompile(`[*_]{1,2}([^*_]+)[*_]{1,2}`).ReplaceAllString(p, "$1") // Bold/italic
		p = regexp.MustCompile(`^[-*+] `).ReplaceAllString(p, "") // List markers
		p = strings.TrimSpace(p)
		if p != "" {
			return p
		}
	}
	return ""
}

// GetEntries dynamically reads review markdown files
func GetEntries() ([]ReviewEntry, error) {
	files, err := os.ReadDir("./review")
	if err != nil {
		return nil, errors.Wrap(err, "error reading review directory")
	}

	var entries []ReviewEntry

	for _, file := range files {
		name := file.Name()
		
		// Skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			continue
		}

		path := fmt.Sprintf("./review/%s", name)
		content, err := os.ReadFile(path)
		if err != nil {
			continue // Skip files we can't read
		}

		// Parse markdown with frontmatter
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
		if err := md.Convert(content, &buf, parser.WithContext(context)); err != nil {
			continue // Skip files we can't parse
		}

		// Extract metadata
		metaData := meta.Get(context)
		
		// Get title from metadata or extract from content
		var title string
		if t, ok := metaData["title"].(string); ok && t != "" {
			title = t
		} else {
			// Try to extract from first H1
			contentHTML := buf.String()
			if strings.Contains(contentHTML, "<h1") {
				start := strings.Index(contentHTML, ">") + 1
				end := strings.Index(contentHTML, "</h1>")
				if start > 0 && end > start {
					title = contentHTML[start:end]
				}
			}
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

		// Generate slug from filename (remove .md extension)
		slug := strings.TrimSuffix(name, ".md")

		// Extract first paragraph
		firstParagraph := extractFirstParagraph(string(content))

		entries = append(entries, ReviewEntry{
			Title:          title,
			Slug:           slug,
			FirstParagraph: firstParagraph,
			Date:           date,
		})
	}

	// Sort by date, newest first
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})

	return entries, nil
}

// Entries is a compatibility variable that returns the dynamic entries
var Entries = func() []ReviewEntry {
	entries, err := GetEntries()
	if err != nil {
		// Return empty slice on error
		return []ReviewEntry{}
	}
	return entries
}()