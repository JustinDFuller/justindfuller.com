package main

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

type Page struct {
	URL          string
	File         string
	ReadFileFrom string
	ContentType  string
}

func main() {
	var pages = []Page{
		{URL: "/aphorism", File: "aphorism.html"},
		{URL: "/poem", File: "poem.html"},
		{URL: "/story", File: "story.html"},
		{URL: "/story/the_philosophy_of_trees", File: "the_philosophy_of_trees.html"},
		{URL: "/story/the_philosophy_of_lovers", File: "the_philosophy_of_lovers.html"},
		{URL: "/story/bridge", File: "bridge.html"},
		{URL: "/story/nothing", File: "nothing.html"},
		{URL: "/review", File: "review.html"},
		{URL: "/review/zen-and-the-art-of-motorcycle-maintenance", File: "zen-and-the-art-of-motorcycle-maintenance.html"},
		{URL: "/review/living-on-24-hours-a-day", File: "living-on-24-hours-a-day.html"},
		{URL: "/review/howards-end", File: "howards-end.html"},
		{URL: "/review/walden", File: "walden.html"},
		{URL: "/review/the-history-of-modern-political-philosophy", File: "the-history-of-modern-political-philosophy.html"},
		{URL: "/thought", File: "thought.html"},
		{URL: "/thought/responses", File: "thought-responses.html"},
		{URL: "/make", File: "make.html"},
		{URL: "/grass/worker.js", File: "grass-service-worker.js", ContentType: "application/javascript"},
		{URL: "/grass", File: "grass.html"},
		{URL: "/kit", File: "kit.html"},
		{URL: "/avatar", File: "avatar.html"},
		{URL: "/weeks-remaining", File: "weeks-remaining.html"},
		{URL: "/word/quality", File: "quality.html"},
		{URL: "/word/equipoise", File: "equipoise.html"},
		{URL: "/word/flexible", File: "flexible.html"},
		{URL: "/word", File: "word.html"},
		{URL: "/nature/anolis-carolinensis", File: "nature-anolis-carolinensis.html"},
		{URL: "/nature", File: "nature.html"},
		{URL: "/2022/01/living-on-24-hours-a-day", ReadFileFrom: "/review/living-on-24-hours-a-day", File: "living-on-24-hours-a-day.html"},
		{URL: "/review/living-on-24-hours-a-day", File: "living-on-24-hours-a-day.html"},
		{URL: "/", File: "index.html"},
	}

	ctx := context.Background()
	buildDir := ".build"

	var wgMain errgroup.Group
	var wgPages errgroup.Group

	wgMain.Go(func() error {
		for _, page := range pages {
			wgPages.Go(func() error {
				u := page.URL
				if u == "" {
					u = page.File
				}

				if err := downloadFile(ctx, u, filepath.Join(buildDir, page.File)); err != nil {
					return errors.Wrapf(err, "error reading %s", u)
				}

				return nil
			})
		}

		if err := wgPages.Wait(); err != nil {
			return errors.Wrap(err, "Error reading file(s)")
		}

		return nil
	})

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

		return nil
	})

	if err := wgMain.Wait(); err != nil {
		log.Fatalf("Error building: %s", err)
	}
}

func downloadFile(ctx context.Context, urlPath, dest string) error {
	url := fmt.Sprintf("http://localhost:9000%s", urlPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return errors.Wrap(err, "error generating request")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetching %s: %w", url, err)
	}
	defer resp.Body.Close()

	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("creating %s: %w", dest, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return fmt.Errorf("writing to %s: %w", dest, err)
	}

	return nil
}
