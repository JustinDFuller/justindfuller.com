package site

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/justindfuller/justindfuller.com/about"
	"github.com/justindfuller/justindfuller.com/aphorism"
	grass "github.com/justindfuller/justindfuller.com/make"
	"github.com/justindfuller/justindfuller.com/nature"
	"github.com/justindfuller/justindfuller.com/obsidian"
	"github.com/justindfuller/justindfuller.com/poem"
	"github.com/justindfuller/justindfuller.com/programming"
	"github.com/justindfuller/justindfuller.com/review"
	"github.com/justindfuller/justindfuller.com/story"
	"github.com/justindfuller/justindfuller.com/thought"
	"github.com/justindfuller/justindfuller.com/word"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

type data[T any] struct {
	Title    string
	SubTitle string
	Meta     string
	Entries  []T
	Entry    T
}

const (
	yellow              = "\033[33m"
	noColor             = "\033[0m"
	cacheControlOneDay  = "public, max-age=86400"
	cacheControlOneYear = "public, max-age=31536000"
)

func logWarning(message string, err error) {
	fmt.Println("⚠️  "+yellow+message+":"+noColor, err)
}

func setOneDayCache(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlOneDay)
}

func setOneYearCache(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlOneYear)
}

func withOneDayCache(handler func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		setOneDayCache(w)
		handler(w, r)
	}
}

func withOneYearCache(handler func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		setOneYearCache(w)
		handler(w, r)
	}
}

func New() (http.Handler, error) {
	entries, err := LoadProgramming()
	if err != nil {
		return nil, err
	}
	return newWithEntries(entries)
}

func NewWithPrepared(prepared obsidian.Prepared, mode obsidian.Mode) (http.Handler, error) {
	if err := obsidian.ValidatePrepared(prepared, mode); err != nil {
		return nil, err
	}
	handler, err := newWithEntries(prepared.Entries)
	if err != nil {
		return nil, err
	}
	if mode == obsidian.ModeProduction {
		return handler, nil
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := &privateResponseWriter{ResponseWriter: w}
		handler.ServeHTTP(recorder, r)
	}), nil
}

func newWithEntries(programmingEntries []programming.Entry) (http.Handler, error) {
	bySlug := map[string]programming.Entry{}
	for _, entry := range programmingEntries {
		if !entry.IsDraft {
			bySlug[entry.Slug] = entry
		}
	}
	funcs := template.FuncMap{
		"sub1": func(x int) int { return x - 1 },
		"dict": func(values ...interface{}) (map[string]interface{}, error) {
			if len(values)%2 != 0 {
				return nil, errors.New("dict requires an even number of arguments")
			}
			dict := make(map[string]interface{})
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					return nil, errors.New("dict keys must be strings")
				}
				dict[key] = values[i+1]
			}
			return dict, nil
		},
	}

	templates := template.New("").Funcs(funcs).Option("missingkey=error")

	sourceRoot, err := os.OpenRoot(".")
	if err != nil {
		return nil, err
	}
	defer func() { _ = sourceRoot.Close() }()
	roots := []string{".", "about", "aphorism", "make", "nature", "poem", "programming", "review", "story", "thought", "word"}
	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				if path != root {
					return fs.SkipDir
				}
				return nil
			}
			switch filepath.Ext(path) {
			case ".js", ".css", ".html", ".tmpl":
				b, err := sourceRoot.ReadFile(path)
				if err != nil {
					return err
				}
				_, err = templates.New("/" + filepath.ToSlash(path)).Parse(string(b))
				return err
			}
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("load templates: %w", err)
		}
	}
	mux := http.NewServeMux()
	paths, err := pagePathsWithEntries(programmingEntries)
	if err != nil {
		return nil, err
	}
	sitemap, err := renderSitemap(paths)
	if err != nil {
		return nil, err
	}
	mux.HandleFunc("/sitemap.xml", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		setOneDayCache(w)
		_, _ = w.Write(sitemap)
	})

	mux.HandleFunc("/aphorism/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path != "/aphorism" && path != "/aphorism/" {
			parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
			if len(parts) == 3 && parts[1] == "aphorism" && parts[2] != "" {
				entry, err := aphorism.GetEntry(parts[2])
				if err != nil {
					http.Error(w, "Aphorism not found", http.StatusNotFound)
					logWarning("Error reading aphorism", err)
					return
				}

				if err := renderTemplate(templates, w, "/aphorism/entry.template.html", data[aphorism.Entry]{
					Title: fmt.Sprintf("Aphorism #%d", entry.Number),
					Meta:  "aphorism",
					Entry: entry,
				}); err != nil {
					log.Printf("template execution error=%s template=%s", err, "/aphorism/entry.template.html")
					http.Error(w, "Error displaying aphorism", http.StatusInternalServerError)
				}
				return
			}
		}

		entries, err := aphorism.Entries()
		if err != nil {
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
			logWarning("Error reading Aphorisms", err)

			return
		}

		if err := renderTemplate(templates, w, "/aphorism/main.template.html", data[[]byte]{
			Title:   "Aphorism",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/aphorism/main.template.html")
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
		}
	}))

	mux.HandleFunc("/word", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entries, err := word.Entries()
		if err != nil {
			http.Error(w, "Error reading Words", http.StatusInternalServerError)
			logWarning("Error reading Words", err)

			return
		}

		if err := renderTemplate(templates, w, "/word/main.template.html", data[[]byte]{
			Title:   "Word",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	}))

	mux.HandleFunc("/word/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/word/" {
			http.Redirect(w, r, "/word", http.StatusMovedPermanently)
			return
		}
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Word not found.", http.StatusNotFound)
			log.Printf("Word not found: %s", r.URL.Path)

			return
		}

		entry, err := word.GetEntry(paths[last])
		if err != nil {
			http.Error(w, "Word not found.", http.StatusNotFound)
			log.Printf("Word not found: %s - %s", r.URL.Path, err)

			return
		}

		if err := renderTemplate(templates, w, "/word/entry.template.html", data[word.Entry]{
			Title:    entry.Title,
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	}))

	mux.HandleFunc("/poem/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path != "/poem" && path != "/poem/" {
			parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
			if len(parts) == 3 && parts[1] == "poem" && parts[2] != "" {
				entry, err := poem.GetEntry(parts[2])
				if err != nil {
					http.Error(w, "Poem not found", http.StatusNotFound)
					logWarning("Error reading poem", err)
					return
				}
				if err := renderTemplate(templates, w, "/poem/entry.template.html", data[poem.Entry]{
					Title: entry.Title,
					Meta:  "poem",
					Entry: entry,
				}); err != nil {
					log.Printf("template execution error=%s template=%s", err, "/poem/entry.template.html")
					http.Error(w, "Error displaying poem", http.StatusInternalServerError)
				}
				return
			}
		}
		entries, err := poem.Entries()
		if err != nil {
			http.Error(w, "Error reading poems.", http.StatusInternalServerError)
			log.Printf("Error reading poems: %s", err)

			return
		}

		if err := renderTemplate(templates, w, "/poem/main.template.html", data[[]byte]{
			Title:   "Poem",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/poem/main.template.html")
		}
	}))

	mux.HandleFunc("/grass.webmanifest", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/grass.webmanifest")
	}))

	mux.HandleFunc("/grass/worker.js", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, "./make/grass.worker.js")
	}))

	mux.HandleFunc("/grass", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		if err := renderTemplate(templates, w, "/make/grass.template.html", data[[]byte]{
			Title: "Grass",
			Meta:  "grass",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/grass.template.html")
		}
	}))

	mux.HandleFunc("/kit", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		if err := renderTemplate(templates, w, "/make/kit.template.html", data[[]byte]{
			Title: "A Game with Kit",
			Meta:  "kit",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/kit.template.html")
		}
	}))

	mux.HandleFunc("/weeks-remaining", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		if err := renderTemplate(templates, w, "/make/remaining.template.html", data[[]byte]{
			Title: "Weeks Remaining",
			Meta:  "Weeks Remaining",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/remaining.template.html")
		}
	}))

	mux.HandleFunc("/story", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entries := story.GetPublishedEntries()
		if err := renderTemplate(templates, w, "/story/main.template.html", data[story.Entry]{
			Title:   "Story",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/story/main.template.html")
		}
	}))

	mux.HandleFunc("/story/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Story not found.", http.StatusNotFound)
			log.Printf("Story not found: %s", r.URL.Path)

			return
		}

		entry, err := story.GetEntry(paths[last])
		if err != nil {
			http.Error(w, "Story not found.", http.StatusNotFound)
			log.Printf("Story not found: %s - %s", r.URL.Path, err)

			return
		}

		if err := renderTemplate(templates, w, "/story/entry.template.html", data[story.EntryWithContent]{
			Title:    entry.Title,
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/story/entry.template.html")
		}
	}))

	mux.HandleFunc("/thought", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entries, err := thought.GetEntries()
		if err != nil {
			log.Printf("Error getting thought entries: %s", err)
			entries = []thought.Entry{}
		}

		if err := renderTemplate(templates, w, "/thought/main.template.html", data[thought.Entry]{
			Title:   "Thought",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/thought/main.template.html")
		}
	}))

	mux.HandleFunc("/thought/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "thought entry not found.", http.StatusNotFound)
			log.Printf("thought entry not found: %s", r.URL.Path)

			return
		}

		entry, err := thought.GetEntry(paths[last])
		if err != nil {
			http.Error(w, "Thought entry not found.", http.StatusNotFound)
			log.Printf("Thought entry not found: %s - %s", r.URL.Path, err)

			return
		}

		if err := renderTemplate(templates, w, "/thought/entry.template.html", data[thought.Entry]{
			Title:    entry.Title,
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/thought/entry.template.html")
		}
	}))

	mux.HandleFunc("/programming", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entries := programmingEntries
		if err := renderTemplate(templates, w, "/programming/main.template.html", data[programming.Entry]{
			Title:   "Programming",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/programming/main.template.html")
		}
	}))

	mux.HandleFunc("/programming/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/programming/" {
			http.Redirect(w, r, "/programming", http.StatusMovedPermanently)
			return
		}
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Programming post not found.", http.StatusNotFound)
			log.Printf("Programming post not found: %s", r.URL.Path)

			return
		}

		entry, found := bySlug[paths[last]]
		if !found || len(paths) != 3 {
			http.Error(w, "Programming post not found.", http.StatusNotFound)
			return
		}

		if err := renderTemplate(templates, w, "/programming/entry.template.html", data[programming.Entry]{
			Title:    entry.Title,
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/programming/entry.template.html")
		}
	}))

	mux.HandleFunc("/review", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		if err := renderTemplate(templates, w, "/review/main.template.html", data[review.Entry]{
			Title:   "Review",
			Entries: review.Entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/review/main.template.html")
		}
	}))

	mux.HandleFunc("/review/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Review not found.", http.StatusNotFound)
			log.Printf("Review not found: %s", r.URL.Path)

			return
		}

		entry, err := review.GetEntry(paths[last])
		if err != nil {
			http.Error(w, "Review not found.", http.StatusNotFound)
			log.Printf("Review not found: %s - %s", r.URL.Path, err)

			return
		}

		if err := renderTemplate(templates, w, "/review/entry.template.html", data[review.EntryWithContent]{
			Title:    entry.Title,
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/review/entry.template.html")
		}
	}))

	mux.HandleFunc("/make", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		if err := renderTemplate(templates, w, "/make/main.template.html", data[grass.ProjectEntry]{
			Title:   "Make",
			Entries: grass.Entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/main.template.html")
		}
	}))

	mux.HandleFunc("/make/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/make", http.StatusMovedPermanently)
	})

	mux.HandleFunc("/nature", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entries, err := nature.Entries()
		if err != nil {
			log.Printf("Error reading ./image/nature: %s", err)
			http.Error(w, "Error loading page.", http.StatusInternalServerError)

			return
		}

		if err := renderTemplate(templates, w, "/nature/main.html.tmpl", data[nature.Entry]{
			Title:   "Nature",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/nature/main.html.tmpl")
		}
	}))

	mux.HandleFunc("/nature/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Nature not found.", http.StatusNotFound)
			log.Printf("Nature not found: %s", r.URL.Path)

			return
		}

		entry, err := nature.EntryBySlug(paths[last])
		if err != nil {
			http.Error(w, "Error reading review.", http.StatusInternalServerError)
			log.Printf("Error reading review: %s", err)

			return
		}

		if err := renderTemplate(templates, w, "/nature/entry.html.tmpl", data[nature.Entry]{
			Title:    title(paths[last]),
			SubTitle: entry.SubTitle,
			Entry:    entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	}))

	mux.HandleFunc("/image/", withOneYearCache(func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	}))

	mux.HandleFunc("/fonts/", withOneYearCache(func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	}))

	mux.HandleFunc("/static/", withOneYearCache(func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	}))

	mux.HandleFunc("/site.webmanifest", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./site.webmanifest")
	}))

	mux.HandleFunc("/about", withOneDayCache(func(w http.ResponseWriter, _ *http.Request) {
		entry := about.Get()
		if err := renderTemplate(templates, w, "/about/main.template.html", data[about.Entry]{
			Title: "About Me",
			Entry: entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/about/main.template.html")
		}
	}))

	mux.HandleFunc("/about/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/about", http.StatusMovedPermanently)
	})

	mux.HandleFunc("/", withOneDayCache(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			w.WriteHeader(http.StatusNotFound)
			log.Printf("404 - Path not found: %s", r.URL.Path)
		}

		if err := renderTemplate(templates, w, "/main.template.html", data[[]byte]{}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/main.template.html")
		}
	}))

	return mux, nil
}

func title(s string) string {
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "-", " ")

	return cases.Title(language.AmericanEnglish).String(s)
}

func renderTemplate(templates *template.Template, w http.ResponseWriter, name string, value any) error {
	var body bytes.Buffer
	if err := templates.ExecuteTemplate(&body, name, value); err != nil {
		http.Error(w, "Error rendering page", http.StatusInternalServerError)
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err := w.Write(body.Bytes())
	return err
}
