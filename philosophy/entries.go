package philosophy

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

func Entry(want string) ([]byte, error) {
	files, err := os.ReadDir("./philosophy")
	if err != nil {
		return nil, errors.Wrap(err, "error reading philosophy directory")
	}

	var name string

	for _, dir := range files {
		if n := dir.Name(); strings.HasSuffix(n, fmt.Sprintf("%s.md", want)) {
			name = n
		}
	}

	if name == "" {
		return nil, errors.New("not found")
	}

	path := fmt.Sprintf("./philosophy/%s", name)

	file, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrapf(err, "error reading philosophy entry: %s", path)
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
