package nature

import (
	"bytes"
	"fmt"
	"os"
	"slices"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

type Entry struct {
	Title    string
	SubTitle string
	Slug     string
	Image    string
	Markdown string
}

var entries []Entry
var entryError error

func init() {
	var images []string

	files, err := os.ReadDir("./image/nature")
	if err != nil {
		entries = nil
		entryError = errors.Wrap(err, "error reading nature image directory")

		return
	}

	for _, file := range files {
		images = append(images, file.Name())
	}

	hardCodedEntries := []Entry{
		{
			Title:    "Anolis Carolinensis",
			SubTitle: "Carolina Anole",
			Slug:     "anolis-carolinensis",
			Image:    "anole.jpg",
		},
	}

	for i, entry := range hardCodedEntries {
		path := fmt.Sprintf("./nature/%s.md", entry.Slug)

		file, err := os.ReadFile(path)
		if err != nil {
			continue
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
			continue
		}

		hardCodedEntries[i].Markdown = buf.String()
	}

	for _, image := range images {
		if !slices.ContainsFunc(hardCodedEntries, func(e Entry) bool {
			return e.Image == image
		}) {
			hardCodedEntries = append(hardCodedEntries, Entry{
				Title: "",
				Slug:  "",
				Image: image,
			})
		}
	}

	entries = hardCodedEntries
	entryError = nil
}

func Entries() ([]Entry, error) {
	return entries, entryError
}

func EntryBySlug(slug string) (Entry, error) {
	for _, entry := range entries {
		if entry.Slug == slug {
			return entry, nil
		}
	}

	return Entry{}, errors.New("not found")
}
