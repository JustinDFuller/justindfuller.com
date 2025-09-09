// Package nature handles nature-related content entries
package nature

import (
	"bytes"
	"fmt"
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

// Entry represents a nature content entry with its metadata
type Entry struct {
	Title    string
	SubTitle string
	Slug     string
	Image    string
	Markdown string
	Date     time.Time
}

var (
	entries  []Entry //nolint:gochecknoglobals
	errEntry error   //nolint:gochecknoglobals
)

func init() { //nolint:gochecknoinits
	// Read markdown files from nature directory
	markdownFiles, err := os.ReadDir("./nature")
	if err != nil {
		entries = nil
		errEntry = errors.Wrap(err, "error reading nature directory")
		return
	}

	// Read images from image/nature directory
	imageFiles, err := os.ReadDir("./image/nature")
	if err != nil {
		// Continue without images
		imageFiles = []os.DirEntry{}
	}

	images := make(map[string]bool)
	for _, file := range imageFiles {
		if !file.IsDir() {
			images[file.Name()] = true
		}
	}

	dynamicEntries := []Entry{}

	// Process each markdown file
	for _, file := range markdownFiles {
		name := file.Name()
		
		// Skip non-markdown files
		if !strings.HasSuffix(name, ".md") || file.IsDir() {
			continue
		}

		path := fmt.Sprintf("./nature/%s", name)
		content, err := os.ReadFile(path) //nolint:gosec // Path is from filtered directory listing
		if err != nil {
			continue
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
			continue
		}

		// Extract metadata
		metaData := meta.Get(context)
		
		// Get title from metadata
		title := ""
		if t, ok := metaData["title"].(string); ok {
			title = t
		}

		// Get subtitle from metadata
		subtitle := ""
		if s, ok := metaData["subtitle"].(string); ok {
			subtitle = s
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

		// Try to find matching image
		imageName := ""
		// Check for common image names based on slug
		possibleImages := []string{
			slug + ".jpg",
			slug + ".png",
			slug + ".jpeg",
			"anole.jpg", // Legacy hardcoded image for anolis-carolinensis
		}
		for _, img := range possibleImages {
			if images[img] {
				imageName = img
				break
			}
		}

		dynamicEntries = append(dynamicEntries, Entry{
			Title:    title,
			SubTitle: subtitle,
			Slug:     slug,
			Image:    imageName,
			Markdown: buf.String(),
			Date:     date,
		})
	}

	// Add entries for images without markdown files
	for image := range images {
		hasMarkdown := false
		for _, entry := range dynamicEntries {
			if entry.Image == image {
				hasMarkdown = true
				break
			}
		}
		if !hasMarkdown {
			dynamicEntries = append(dynamicEntries, Entry{
				Title: "",
				Slug:  "",
				Image: image,
			})
		}
	}

	entries = dynamicEntries
	errEntry = nil
}

// Entries returns all nature entries from the filesystem
func Entries() ([]Entry, error) {
	return entries, errEntry
}

// EntryBySlug retrieves a specific nature entry by its slug
func EntryBySlug(slug string) (Entry, error) {
	for _, entry := range entries {
		if entry.Slug == slug {
			return entry, nil
		}
	}

	return Entry{}, errors.New("not found")
}