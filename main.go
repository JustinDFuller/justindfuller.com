package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/justindfuller/justindfuller.com/aphorism"
	grass "github.com/justindfuller/justindfuller.com/make"
	"github.com/justindfuller/justindfuller.com/poem"
	"github.com/justindfuller/justindfuller.com/review"
	"github.com/justindfuller/justindfuller.com/story"
	"github.com/justindfuller/justindfuller.com/word"
	"github.com/justindfuller/secretmanager"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

type data struct {
	Title   string
	Meta    string
	Entries [][]byte
	Entry   []byte
}

const (
	yellow  = "\033[33m"
	red     = "\033[31m"
	blue    = "\033[34m"
	noColor = "\033[0m"
)

func logWarning(message string, err error) {
	fmt.Println("⚠️  "+yellow+message+":"+noColor, err)
}

func logError(message string, err any) {
	fmt.Println("🛑  "+red+message+":"+noColor, err)
	os.Exit(1)
}

func logInfo(message string, info string) {
	fmt.Println(blue+"🛈  "+message+":"+noColor, info)
}

func main() {
	var reminderConfig grass.ReminderConfig
	if err := secretmanager.Parse(&reminderConfig); err != nil {
		logWarning("Error reading secrets", err)
	}

	dir, err := os.ReadDir("./")
	if err != nil {
		logError("Error reading dir", err)
	}

	type File struct {
		Path string
		Dir  bool
	}

	var mut sync.Mutex
	var files []File //nolint:prealloc // false positive

	for _, entry := range dir {
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		if strings.HasPrefix(entry.Name(), "node_modules") {
			continue
		}

		mut.Lock()

		files = append(files, File{
			Path: "/" + entry.Name(),
			Dir:  entry.IsDir(),
		})

		mut.Unlock()
	}

	templates := template.New("").Option("missingkey=error")

	suffixes := []string{".js", ".css", ".html", ".tmpl"}

	for i := 0; i < len(files); i++ {
		file := files[i]
		path := file.Path

		if file.Dir {
			dir, err := os.ReadDir("." + path)
			if err != nil {
				logError("Error reading dir", path)
			}

			for _, entry := range dir {
				files = append(files, File{
					Path: path + "/" + entry.Name(),
					Dir:  entry.IsDir(),
				})
			}
		}

		for _, suffix := range suffixes {
			if strings.HasSuffix(file.Path, suffix) {
				b, err := os.ReadFile("." + file.Path)
				if err != nil {
					log.Fatalf("File read error=%s file=%s", err, file.Path)
				}

				if _, err := templates.New(file.Path).Parse(string(b)); err != nil {
					log.Fatalf("Template parse error=%s path=%s", err, file.Path)
				}

				break
			}
		}
	}

	http.HandleFunc("/aphorism", func(w http.ResponseWriter, r *http.Request) {
		entries, err := aphorism.Entries()
		if err != nil {
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
			logWarning("Error reading Aphorisms", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/aphorism/main.template.html", data{
			Title:   "Aphorism",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/aphorism/main.template.html")
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
		}
	})

	http.HandleFunc("/word", func(w http.ResponseWriter, r *http.Request) {
		entry, err := word.Entry("entries")
		if err != nil {
			http.Error(w, "Error reading Words", http.StatusInternalServerError)
			logWarning("Error reading Words", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/word/main.template.html", data{
			Title: "Word",
			Entry: entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	})

	http.HandleFunc("/word/", func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Word not found.", http.StatusNotFound)
			log.Printf("Word not found: %s", r.URL.Path)

			return
		}

		entry, err := word.Entry(paths[last])
		if err != nil {
			http.Error(w, "Error reading Words", http.StatusInternalServerError)
			log.Printf("Error reading Words: %s", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/word/entry.template.html", data{
			Title: Title(paths[last]),
			Entry: entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		entries, err := poem.Entries()
		if err != nil {
			http.Error(w, "Error reading poems.", http.StatusInternalServerError)
			log.Printf("Error reading poems: %s", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/poem/main.template.html", data{
			Title:   "Poem",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/poem/main.template.html")
		}
	})
	http.HandleFunc("/grass.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/grass.webmanifest")
	})

	http.HandleFunc("/grass/worker.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/grass.worker.js")
	})

	http.HandleFunc("/grass", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/make/grass.template.html", data{
			Title: "Grass",
			Meta:  "grass",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/grass.template.html")
		}
	})

	http.HandleFunc("/kit", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/make/kit.template.html", data{
			Title: "A Game with Kit",
			Meta:  "kit",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/kit.template.html")
		}
	})

	http.HandleFunc("/story", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/story/main.template.html", data{
			Title: "Story",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/story/main.template.html")
		}
	})

	http.HandleFunc("/story/", func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Story not found.", http.StatusNotFound)
			log.Printf("Story not found: %s", r.URL.Path)

			return
		}

		entry, err := story.Entry(paths[last])
		if err != nil {
			http.Error(w, "Error reading story.", http.StatusInternalServerError)
			log.Printf("Error reading story: %s", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/story/story.template.html", data{
			Title: Title(paths[last]),
			Entry: entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/story/story.template.html")
		}
	})

	http.HandleFunc("/review", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/review/main.template.html", data{
			Title: "Review",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/review/main.template.html")
		}
	})

	http.HandleFunc("/review/", func(w http.ResponseWriter, r *http.Request) {
		paths := strings.Split(r.URL.Path, "/")
		last := len(paths) - 1

		if len(paths) == 0 {
			http.Error(w, "Review not found.", http.StatusNotFound)
			log.Printf("Review not found: %s", r.URL.Path)

			return
		}

		entry, err := review.Entry(paths[last])
		if err != nil {
			http.Error(w, "Error reading review.", http.StatusInternalServerError)
			log.Printf("Error reading review: %s", err)

			return
		}

		if err := templates.ExecuteTemplate(w, "/review/review.template.html", data{
			Title: Title(paths[last]),
			Entry: entry,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/word/main.template.html")
		}
	})

	http.HandleFunc("/make", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/make/main.template.html", data{
			Title: "Make",
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/make/main.template.html")
		}
	})

	http.HandleFunc("/nature", func(w http.ResponseWriter, r *http.Request) {
		var entries [][]byte

		files, err := os.ReadDir("./image/nature")
		if err != nil {
			log.Printf("Error reading ./image/nature: %s", err)
			http.Error(w, "Error loading page.", http.StatusInternalServerError)

			return
		}

		for _, file := range files {
			entries = append(entries, []byte(file.Name()))
		}

		if err := templates.ExecuteTemplate(w, "/nature/main.html.tmpl", data{
			Title:   "Nature",
			Entries: entries,
		}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/nature/main.html.tmpl")
		}
	})

	http.HandleFunc("/image/", func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	})

	http.HandleFunc("/reminder/set", grass.SetHandler)

	http.HandleFunc("/reminder/send", grass.SendHandler(reminderConfig))

	http.HandleFunc("/site.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./site.webmanifest")
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if err := templates.ExecuteTemplate(w, "/main.template.html", data{}); err != nil {
			log.Printf("template execution error=%s template=%s", err, "/main.template.html")
		}
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	logInfo("Listening on port", "http://localhost"+port)

	s := http.Server{
		Addr:              port,
		Handler:           nil,
		ReadTimeout:       time.Second,
		ReadHeaderTimeout: time.Second,
		WriteTimeout:      time.Second,
		IdleTimeout:       time.Second,
	}

	if err := s.ListenAndServe(); err != nil {
		logError("Error listening to port", err)
	}
}

func Title(s string) string {
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "-", " ")

	return cases.Title(language.AmericanEnglish).String(s)
}
