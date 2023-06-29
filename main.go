package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"text/template"

	"github.com/justindfuller/justindfuller.com/aphorism"
	"github.com/justindfuller/justindfuller.com/poem"
	"github.com/justindfuller/justindfuller.com/review"
	"github.com/justindfuller/justindfuller.com/story"
	"github.com/justindfuller/justindfuller.com/word"
)

type data struct {
	Entries [][]byte
	Entry   []byte
}

func main() {
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

	http.HandleFunc("/word/quality", func(w http.ResponseWriter, r *http.Request) {
		entry, err := word.Entry("quality")
		if err != nil {
			http.Error(w, "Error reading Words", http.StatusInternalServerError)
			log.Printf("Error reading Words: %s", err)

			return
		}

		template.Must(template.ParseFiles("./word/entry.template.html")).Execute(w, data{
			Entry: entry,
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
			Entry: entry,
		})
	})

	http.HandleFunc("/make", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/main.template.html")
	})

	http.HandleFunc("/image/", func(w http.ResponseWriter, r *http.Request) {
		log.Print(r.URL.Path)
		http.ServeFile(w, r, fmt.Sprintf(".%s", r.URL.Path))
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./main.template.html")
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
