// Package about handles the about page content and metadata
package about

import (
	"bytes"
	_ "embed"
	"time"

	"github.com/justindfuller/justindfuller.com/renderer"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

//go:embed about.md
// AboutContent holds the markdown content for the about page
var AboutContent string

// Entry represents the about page with its content
type Entry struct {
	Title   string
	Content string
	Date    time.Time
}

// Get returns the about page entry with processed content
func Get() Entry {
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
	if err := md.Convert([]byte(AboutContent), &buf, parser.WithContext(context)); err != nil {
		// Return raw content if conversion fails
		return Entry{
			Content: AboutContent,
		}
	}

	// Extract metadata
	metaData := meta.Get(context)
	
	// Get title from metadata
	title := ""
	if t, ok := metaData["title"].(string); ok {
		title = t
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

	return Entry{
		Title:   title,
		Content: buf.String(),
		Date:    date,
	}
}