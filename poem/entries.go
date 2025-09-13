// Package poem handles poem content and metadata
package poem

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/renderer"
	"github.com/pkg/errors"
	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/parser"
	"golang.org/x/sync/errgroup"
)

// Entry represents a single poem with metadata
type Entry struct {
	Number  int
	Content template.HTML
	Title   string
	Date    time.Time
}

// Entries returns all poem entries as byte arrays
func Entries() ([][]byte, error) {
	files, err := os.ReadDir("./poem")
	if err != nil {
		return nil, errors.Wrap(err, "error reading poetry entries")
	}

	names := make([]string, 0, len(files))

	for _, dir := range files {
		name := dir.Name()

		// skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			log.Printf("Skipping %s because it does not end with .md", name)

			continue
		}

		// skip sub-dirs
		if dir.IsDir() {
			log.Printf("Skipping %s because it is a directory", dir.Name())

			continue
		}

		split := strings.Split(name, ".")

		if len(split) != 2 { //nolint:mnd
			log.Printf("Skipping %s because it was not split in two.", name)

			continue
		}

		fileName := split[0]

		// skip any files that are not numeric
		if _, err := strconv.Atoi(fileName); err != nil {
			fmt.Printf("Skipping %s because it is not a number.", name)

			continue
		}

		names = append(names, name)
	}

	sort.Slice(names, func(i, j int) bool {
		s1 := strings.Split(names[i], ".")[0]
		s2 := strings.Split(names[j], ".")[0]

		n1, err := strconv.Atoi(s1)
		if err != nil {
			log.Fatalf("Error parsing string to int: %s", err)
		}

		n2, err := strconv.Atoi(s2)
		if err != nil {
			log.Fatalf("Error parsing string to int: %s", err)
		}

		return n2 > n1
	})

	contents := make([][]byte, len(names))
	var wg errgroup.Group

	// Create markdown parser with meta extension
	md := goldmark.New(
		goldmark.WithExtensions(meta.Meta, renderer.NewExtension()),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	for i, name := range names {
		wg.Go(func() error {
			// Clean the path to prevent directory traversal
			path := filepath.Join("./poem", filepath.Clean(name))

			file, err := os.ReadFile(path) //nolint:gosec // Path is from filtered directory listing
			if err != nil {
				return errors.Wrapf(err, "error reading file: %s", path)
			}

			// Parse the markdown to extract frontmatter
			var buf bytes.Buffer
			context := parser.NewContext()
			if err := md.Convert(file, &buf, parser.WithContext(context)); err != nil {
				// If parsing fails, fall back to old method
				// We intentionally ignore the error here and use fallback parsing
				content := file
				content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
				content = bytes.Split(content, []byte("```"))[1]
				content = bytes.TrimSpace(content)
				contents[i] = content
				return nil //nolint:nilerr // Intentional fallback on parse error
			}

			// Extract content between ```text markers (frontmatter is now respected but we still extract the poem text)
			content := file
			content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
			parts := bytes.Split(content, []byte("```"))
			if len(parts) > 1 {
				content = bytes.TrimSpace(parts[1])
			} else {
				// Fallback if no ``` markers found
				content = bytes.TrimSpace(content)
			}
			contents[i] = content

			return nil
		})
	}

	if err := wg.Wait(); err != nil {
		return nil, errors.Wrap(err, "Error reading poems")
	}

	low := 0
	high := len(contents) - 1

	for high > low {
		contents[low], contents[high] = contents[high], contents[low]
		low++
		high--
	}

	return contents, nil
}

// GetRawEntry retrieves a specific poem by name as raw bytes
func GetRawEntry(name string) ([][]byte, error) {
	// Clean the name to prevent directory traversal
	path := filepath.Join("./poem", filepath.Clean(name)+".md")

	file, err := os.ReadFile(path) //nolint:gosec // Path is sanitized
	if err != nil {
		return nil, errors.Wrapf(err, "error reading file: %s", path)
	}

	// Create markdown parser with meta extension
	md := goldmark.New(
		goldmark.WithExtensions(meta.Meta, renderer.NewExtension()),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	// Parse the markdown to extract frontmatter
	var buf bytes.Buffer
	context := parser.NewContext()
	if err := md.Convert(file, &buf, parser.WithContext(context)); err != nil {
		// If parsing fails, fall back to old method
		// We intentionally ignore the error here and use fallback parsing
		content := file
		content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
		content = bytes.Split(content, []byte("```"))[1]
		content = bytes.TrimSpace(content)
		return [][]byte{content}, nil //nolint:nilerr // Intentional fallback on parse error
	}

	// Extract content between ```text markers (frontmatter is now respected but we still extract the poem text)
	content := file
	content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
	parts := bytes.Split(content, []byte("```"))
	if len(parts) > 1 {
		content = bytes.TrimSpace(parts[1])
	} else {
		// Fallback if no ``` markers found
		content = bytes.TrimSpace(content)
	}

	return [][]byte{content}, nil
}

// GetEntry returns a single poem by number
func GetEntry(number string) (Entry, error) {
	num, err := strconv.Atoi(number)
	if err != nil {
		return Entry{}, errors.Wrap(err, "invalid poem number")
	}

	// Call the existing GetRawEntry function to get the poem content
	contents, err := GetRawEntry(number)
	if err != nil {
		return Entry{}, errors.Wrapf(err, "error reading poem %s", number)
	}

	// Read the file again to extract metadata
	// Clean the number to prevent directory traversal
	path := filepath.Join("./poem", filepath.Clean(number)+".md")
	file, err := os.ReadFile(path) //nolint:gosec // Path is sanitized
	if err != nil {
		return Entry{}, errors.Wrapf(err, "error reading file: %s", path)
	}

	// Parse with goldmark to extract frontmatter
	md := goldmark.New(
		goldmark.WithExtensions(meta.Meta),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	var buf bytes.Buffer
	context := parser.NewContext()
	if err := md.Convert(file, &buf, parser.WithContext(context)); err == nil {
		// Extract metadata if available
		metaData := meta.Get(context)
		
		var title string
		if t, ok := metaData["title"]; ok {
			title = fmt.Sprintf("%v", t)
		} else {
			title = fmt.Sprintf("Poem #%d", num)
		}

		var date time.Time
		if d, ok := metaData["date"]; ok {
			switch v := d.(type) {
			case time.Time:
				date = v
			case string:
				date, _ = time.Parse("2006-01-02", v)
			}
		}

		// Combine all content pieces into a single HTML block
		var contentBuilder strings.Builder
		for _, content := range contents {
			contentBuilder.Write(content)
		}

		return Entry{
			Number:  num,
			Content: template.HTML(contentBuilder.String()), //nolint:gosec // Content is from trusted markdown files
			Title:   title,
			Date:    date,
		}, nil
	}

	// Fallback if metadata parsing fails
	var contentBuilder strings.Builder
	for _, content := range contents {
		contentBuilder.Write(content)
	}

	return Entry{
		Number:  num,
		Content: template.HTML(contentBuilder.String()), //nolint:gosec // Content is from trusted markdown files
		Title:   fmt.Sprintf("Poem #%d", num),
		Date:    time.Time{},
	}, nil
}
