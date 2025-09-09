package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/justindfuller/justindfuller.com/aphorism"
	"github.com/justindfuller/justindfuller.com/nature"
	"github.com/justindfuller/justindfuller.com/poem"
	"github.com/justindfuller/justindfuller.com/programming"
	"github.com/justindfuller/justindfuller.com/review"
	"github.com/justindfuller/justindfuller.com/story"
	"github.com/justindfuller/justindfuller.com/thought"
	"github.com/justindfuller/justindfuller.com/word"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

type Page struct {
	URL          string
	File         string
	ReadFileFrom string
	ContentType  string
}

// GenerateAllRoutes discovers all routes dynamically from the content packages
func GenerateAllRoutes() []Page {
	var pages []Page

	// Static pages (always present)
	pages = append(pages, Page{URL: "/", File: "index.html"})
	pages = append(pages, Page{URL: "/about", File: "about.html"})
	
	// List pages
	pages = append(pages, Page{URL: "/aphorism", File: "aphorism.html"})
	pages = append(pages, Page{URL: "/poem", File: "poem.html"})
	pages = append(pages, Page{URL: "/story", File: "story.html"})
	pages = append(pages, Page{URL: "/review", File: "review.html"})
	pages = append(pages, Page{URL: "/thought", File: "thought.html"})
	pages = append(pages, Page{URL: "/programming", File: "programming.html"})
	pages = append(pages, Page{URL: "/word", File: "word.html"})
	pages = append(pages, Page{URL: "/nature", File: "nature.html"})
	pages = append(pages, Page{URL: "/make", File: "make.html"})

	// Make/project pages
	pages = append(pages, Page{URL: "/grass", File: "grass.html"})
	pages = append(pages, Page{URL: "/grass/worker.js", File: "grass-service-worker.js", ContentType: "application/javascript"})
	pages = append(pages, Page{URL: "/grass.webmanifest", File: "grass.webmanifest", ContentType: "application/manifest+json"})
	pages = append(pages, Page{URL: "/kit", File: "kit.html"})
	pages = append(pages, Page{URL: "/weeks-remaining", File: "weeks-remaining.html"})

	// Manifest
	pages = append(pages, Page{URL: "/site.webmanifest", File: "site.webmanifest", ContentType: "application/manifest+json"})

	// Generate aphorism entries
	aphorismEntries, err := aphorism.Entries()
	if err == nil {
		for i := 1; i <= len(aphorismEntries); i++ {
			pages = append(pages, Page{
				URL:  fmt.Sprintf("/aphorism/%d", i),
				File: fmt.Sprintf("aphorism-%d.html", i),
			})
		}
	} else {
		log.Printf("Warning: Could not generate aphorism routes: %v", err)
	}

	// Generate poem entries
	poemEntries, err := poem.Entries()
	if err == nil {
		for i := 1; i <= len(poemEntries); i++ {
			pages = append(pages, Page{
				URL:  fmt.Sprintf("/poem/%d", i),
				File: fmt.Sprintf("poem-%d.html", i),
			})
		}
	} else {
		log.Printf("Warning: Could not generate poem routes: %v", err)
	}

	// Generate story entries (only published)
	storyEntries := story.GetPublishedEntries()
	for _, entry := range storyEntries {
		slug := entry.Slug
		pages = append(pages, Page{
			URL:  fmt.Sprintf("/story/%s", slug),
			File: fmt.Sprintf("story-%s.html", sanitizeFilename(slug)),
		})
	}

	// Generate review entries
	for _, entry := range review.Entries {
		pages = append(pages, Page{
			URL:  fmt.Sprintf("/review/%s", entry.Slug),
			File: fmt.Sprintf("review-%s.html", sanitizeFilename(entry.Slug)),
		})
	}

	// Generate thought entries
	thoughtEntries, err := thought.GetEntries()
	if err == nil {
		for _, entry := range thoughtEntries {
			pages = append(pages, Page{
				URL:  fmt.Sprintf("/thought/%s", entry.Slug),
				File: fmt.Sprintf("thought-%s.html", sanitizeFilename(entry.Slug)),
			})
		}
	} else {
		log.Printf("Warning: Could not generate thought routes: %v", err)
	}

	// Generate programming entries (only non-draft)
	for _, entry := range programming.Entries {
		if !entry.IsDraft {
			pages = append(pages, Page{
				URL:  fmt.Sprintf("/programming/%s", entry.Slug),
				File: fmt.Sprintf("programming-%s.html", sanitizeFilename(entry.Slug)),
			})
		}
	}

	// Generate word entries
	wordEntries, err := word.Entries()
	if err == nil {
		// Extract slugs from word entries (they're returned as HTML)
		re := regexp.MustCompile(`href="/word/([^"]+)"`)
		for _, entryHTML := range wordEntries {
			matches := re.FindStringSubmatch(string(entryHTML))
			if len(matches) > 1 {
				slug := matches[1]
				pages = append(pages, Page{
					URL:  fmt.Sprintf("/word/%s", slug),
					File: fmt.Sprintf("word-%s.html", sanitizeFilename(slug)),
				})
			}
		}
	} else {
		log.Printf("Warning: Could not generate word routes: %v", err)
	}

	// Generate nature entries
	natureEntries, err := nature.Entries()
	if err == nil {
		for _, entry := range natureEntries {
			pages = append(pages, Page{
				URL:  fmt.Sprintf("/nature/%s", entry.Slug),
				File: fmt.Sprintf("nature-%s.html", sanitizeFilename(entry.Slug)),
			})
		}
	} else {
		log.Printf("Warning: Could not generate nature routes: %v", err)
	}

	// Legacy redirect (keep for backward compatibility)
	pages = append(pages, Page{
		URL:          "/2022/01/living-on-24-hours-a-day",
		ReadFileFrom: "/review/living-on-24-hours-a-day",
		File:         "2022-01-living-on-24-hours-a-day.html",
	})

	return pages
}

// sanitizeFilename removes or replaces characters that might cause issues in filenames
func sanitizeFilename(name string) string {
	// Replace problematic characters
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, ":", "-")
	name = strings.ReplaceAll(name, "*", "-")
	name = strings.ReplaceAll(name, "?", "-")
	name = strings.ReplaceAll(name, "\"", "-")
	name = strings.ReplaceAll(name, "<", "-")
	name = strings.ReplaceAll(name, ">", "-")
	name = strings.ReplaceAll(name, "|", "-")
	return name
}

// WriteRoutesJSON exports the routes to a JSON file for debugging
func WriteRoutesJSON(pages []Page, buildDir string) error {
	data, err := json.MarshalIndent(pages, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(buildDir, "routes.json"), data, 0644)
}

func main() {
	ctx := context.Background()
	buildDir := ".build"

	// Generate all routes dynamically
	pages := GenerateAllRoutes()
	
	// Log the number of routes
	log.Printf("Generated %d routes for static build", len(pages))
	
	// Group routes by type for logging
	routeTypes := make(map[string]int)
	for _, page := range pages {
		parts := strings.Split(page.URL, "/")
		if len(parts) > 1 && parts[1] != "" {
			routeTypes[parts[1]]++
		} else {
			routeTypes["root"]++
		}
	}
	
	log.Println("Routes by type:")
	for routeType, count := range routeTypes {
		log.Printf("  %s: %d", routeType, count)
	}
	
	// Write routes to JSON for inspection
	if err := WriteRoutesJSON(pages, buildDir); err != nil {
		log.Printf("Warning: Failed to write routes.json: %v", err)
	}

	var wgMain errgroup.Group
	
	// Generate static HTML files
	wgMain.Go(func() error {
		var wgPages errgroup.Group

		for _, page := range pages {
			page := page // capture loop variable
			wgPages.Go(func() error {
				dest := filepath.Join(buildDir, page.File)

				urlPath := page.URL
				if page.ReadFileFrom != "" {
					urlPath = page.ReadFileFrom
				}

				url := fmt.Sprintf("http://localhost:9000%s", urlPath)

				req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
				if err != nil {
					return errors.Wrapf(err, "error generating request for %s", url)
				}

				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					return fmt.Errorf("fetching %s: %w", url, err)
				}
				defer func() { _ = resp.Body.Close() }()

				if resp.StatusCode != http.StatusOK {
					return fmt.Errorf("fetching %s returned status %d", url, resp.StatusCode)
				}

				out, err := os.Create(dest)
				if err != nil {
					return fmt.Errorf("creating %s: %w", dest, err)
				}
				defer func() { _ = out.Close() }()

				if _, err := io.Copy(out, resp.Body); err != nil {
					return fmt.Errorf("writing to %s: %w", dest, err)
				}

				log.Printf("Generated: %s -> %s", urlPath, page.File)
				return nil
			})
		}

		if err := wgPages.Wait(); err != nil {
			return errors.Wrap(err, "Error generating static files")
		}

		return nil
	})

	// Generate app.yaml from template
	wgMain.Go(func() error {
		tmplPath := filepath.FromSlash(".appengine/app.tmpl.yaml")

		tmpl, err := template.ParseFiles(tmplPath)
		if err != nil {
			return fmt.Errorf("parsing template: %w", err)
		}

		var buf bytes.Buffer
		if err := tmpl.Execute(&buf, pages); err != nil {
			return fmt.Errorf("executing template: %w", err)
		}

		if err := os.WriteFile("./.appengine/app.yaml", buf.Bytes(), 0600); err != nil {
			return fmt.Errorf("writing app.yaml: %w", err)
		}

		log.Println("Generated app.yaml with all routes")
		return nil
	})

	if err := wgMain.Wait(); err != nil {
		log.Fatalf("Error building: %s", err)
	}
	
	log.Printf("Build complete! Generated %d static files", len(pages))
}