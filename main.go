package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"text/template"

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

func main() {
	var reminderConfig grass.ReminderConfig
	if err := secretmanager.Parse(&reminderConfig); err != nil {
		log.Printf("Error reading secrets: %s", err)
	}

	http.HandleFunc("/aphorism", func(w http.ResponseWriter, r *http.Request) {
		entries, err := aphorism.Entries()
		if err != nil {
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
			log.Printf("Error reading Aphorisms: %s", err)

			return
		}

		template.Must(template.ParseFiles("./aphorism/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/word", func(w http.ResponseWriter, r *http.Request) {
		entry, err := word.Entry("entries")
		if err != nil {
			http.Error(w, "Error reading Words", http.StatusInternalServerError)
			log.Printf("Error reading Words: %s", err)

			return
		}

		template.Must(template.ParseFiles("./word/main.template.html")).Execute(w, data{
			Entry: entry,
		})
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

		template.Must(template.ParseFiles("./word/entry.template.html")).Execute(w, data{
			Title: Title(paths[last]),
			Entry: entry,
		})
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		entries, err := poem.Entries()
		if err != nil {
			http.Error(w, "Error reading poems.", http.StatusInternalServerError)
			log.Printf("Error reading poems: %s", err)

			return
		}

		template.Must(template.ParseFiles("./poem/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})
	http.HandleFunc("/grass.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/grass.webmanifest")
	})

	http.HandleFunc("/grass/worker.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/grass.worker.js")
	})

	http.HandleFunc("/grass", func(w http.ResponseWriter, r *http.Request) {
		if err := template.Must(template.ParseFiles("./make/grass.template.html", "./make/grass.js", "./make/grass.css", "./meta.template.html")).Execute(w, data{
			Title: "Grass",
			Meta:  "grass",
		}); err != nil {
			log.Printf("Error: %s", err)
		}
	})

	http.HandleFunc("/story", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./story/main.template.html")
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

		template.Must(template.ParseFiles("./story/story.template.html")).Execute(w, data{
			Title: Title(paths[last]),
			Entry: entry,
		})
	})

	http.HandleFunc("/review", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./review/main.template.html")
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

		template.Must(template.ParseFiles("./review/review.template.html")).Execute(w, data{
			Title: Title(paths[last]),
			Entry: entry,
		})
	})

	http.HandleFunc("/make", func(w http.ResponseWriter, r *http.Request) {
		if err := template.Must(template.ParseFiles("./make/main.template.html", "./make/main.js", "./make/main.css", "./meta.template.html")).Execute(w, data{
			Title: "Make",
		}); err != nil {
			log.Printf("Error: %s", err)
		}
	})

	http.HandleFunc("/image/", func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	})

	http.HandleFunc("/reminder/set", grass.SetHandler)

	http.HandleFunc("/reminder/send", grass.SendHandler(reminderConfig))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if err := template.Must(template.ParseFiles("./main.template.html", "./main.js", "./main.css", "./meta.template.html")).Execute(w, data{}); err != nil {
			log.Printf("Error: %s", err)
		}
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	log.Printf("Listening on port http://localhost%s", port)
	http.ListenAndServe(port, nil)
}

func Title(s string) string {
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "-", " ")
	return cases.Title(language.AmericanEnglish).String(s)
}
