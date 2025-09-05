package about

import (
	"bytes"
	_ "embed"
	
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

//go:embed about.md
var AboutContent string

type Entry struct {
	Content string
}

func Get() Entry {
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
	if err := md.Convert([]byte(AboutContent), &buf); err != nil {
		// Return raw content if conversion fails
		return Entry{
			Content: AboutContent,
		}
	}

	return Entry{
		Content: buf.String(),
	}
}