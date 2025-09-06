package thought

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"strings"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

type Entry struct {
	Title   string
	Content template.HTML
}

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

	file, err := os.ReadFile(path)
	if err != nil {
		return Entry{}, errors.Wrapf(err, "error reading thought entry: %s", path)
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
		return Entry{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract title from metadata
	metaData := meta.Get(context)
	title := ""
	if t, ok := metaData["title"]; ok {
		if titleStr, ok := t.(string); ok {
			title = titleStr
		}
	}

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

	return Entry{
		Title:   title,
		Content: template.HTML(buf.Bytes()),
	}, nil
}

// GetEntryContent keeps backward compatibility with the old Entry function
func GetEntryContent(want string) ([]byte, error) {
	entry, err := GetEntry(want)
	if err != nil {
		return nil, err
	}
	return []byte(entry.Content), nil
}
