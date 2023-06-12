package word

import (
	"bytes"
	"os"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

func Entry() ([]byte, error) {
	path := "./word/entries.md"

	file, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrapf(err, "error reading review: %s", path)
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
	if err := md.Convert(file, &buf); err != nil {
		return nil, errors.Wrap(err, "error converting markdown")
	}

	return buf.Bytes(), nil
}
