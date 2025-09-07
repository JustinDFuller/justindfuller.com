package aphorism

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// AphorismEntry represents a single aphorism with metadata
type AphorismEntry struct {
	Number  int
	Content template.HTML
	Date    time.Time
}

// Entries returns all aphorism contents as byte arrays for the list page
// Maintains backward compatibility with the existing template
func Entries() ([][]byte, error) {
	entries, err := GetAllEntries()
	if err != nil {
		return nil, err
	}

	// Convert to byte arrays of just the content (no metadata)
	// Reverse order to match original behavior
	result := make([][]byte, len(entries))
	for i, entry := range entries {
		// Put in reverse order (highest number first)
		result[len(entries)-1-i] = []byte(entry.Content)
	}

	return result, nil
}

// GetAllEntries returns all aphorism entries with metadata
func GetAllEntries() ([]AphorismEntry, error) {
	files, err := os.ReadDir("./aphorism")
	if err != nil {
		return nil, errors.Wrap(err, "error reading aphorism directory")
	}

	var entries []AphorismEntry

	for _, file := range files {
		name := file.Name()
		
		// Skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			continue
		}

		// Skip non-numeric files
		numStr := strings.TrimSuffix(name, ".md")
		_, err := strconv.Atoi(numStr)
		if err != nil {
			continue
		}

		entry, err := GetEntry(numStr)
		if err != nil {
			return nil, errors.Wrapf(err, "error reading aphorism %s", name)
		}

		entries = append(entries, entry)
	}

	// Sort by number (ascending)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Number < entries[j].Number
	})

	return entries, nil
}

// GetEntry returns a single aphorism by number
func GetEntry(number string) (AphorismEntry, error) {
	num, err := strconv.Atoi(number)
	if err != nil {
		return AphorismEntry{}, errors.Wrap(err, "invalid aphorism number")
	}

	path := fmt.Sprintf("./aphorism/%s.md", number)
	
	file, err := os.ReadFile(path)
	if err != nil {
		return AphorismEntry{}, errors.Wrapf(err, "error reading aphorism: %s", path)
	}

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, meta.Meta),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
		),
	)

	var buf bytes.Buffer
	context := parser.NewContext()
	if err := md.Convert(file, &buf, parser.WithContext(context)); err != nil {
		return AphorismEntry{}, errors.Wrap(err, "error converting markdown")
	}

	// Extract metadata
	metaData := meta.Get(context)
	
	// Get date from metadata
	var date time.Time
	if d, ok := metaData["date"]; ok {
		switch v := d.(type) {
		case time.Time:
			date = v
		case string:
			date, _ = time.Parse("2006-01-02", v)
		}
	}

	// Get the converted content (just the aphorism text, no frontmatter)
	content := strings.TrimSpace(buf.String())
	
	// Remove any <p> tags that goldmark might add
	content = strings.TrimPrefix(content, "<p>")
	content = strings.TrimSuffix(content, "</p>")
	content = strings.TrimSpace(content)

	return AphorismEntry{
		Number:  num,
		Content: template.HTML(content),
		Date:    date,
	}, nil
}