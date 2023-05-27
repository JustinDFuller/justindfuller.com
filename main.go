package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"text/template"
	"time"

	"github.com/justindfuller/justindfuller.com/aphorism"
	"github.com/justindfuller/justindfuller.com/poem"
	"github.com/justindfuller/justindfuller.com/story"
)

type data struct {
	Entries [][]byte
}

func main() {
	http.HandleFunc("/aphorism", func(w http.ResponseWriter, r *http.Request) {
		entries, err := aphorism.Entries()
		if err != nil {
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
			log.Printf("Error reading Aphorisms: %s", err)

			return
		}

		if id := os.Getenv("GAE_DEPLOYMENT_ID"); id != "" {
			w.Header().Set("ETag", fmt.Sprintf("W/%s", id))
		}
		template.Must(template.ParseFiles("./aphorism/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		entries, err := poem.Entries()
		if err != nil {
			http.Error(w, "Error reading poems.", http.StatusInternalServerError)
			log.Printf("Error reading poems.")

			return
		}

		if id := os.Getenv("GAE_DEPLOYMENT_ID"); id != "" {
			w.Header().Set("ETag", fmt.Sprintf("W/%s", id))
		}
		template.Must(template.ParseFiles("./poem/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/story", func(w http.ResponseWriter, r *http.Request) {
		entries, err := story.Entries()
		if err != nil {
			http.Error(w, "Error reading stories.", http.StatusInternalServerError)
			log.Printf("Error reading stories: %s", err)

			return
		}

		if id := os.Getenv("GAE_DEPLOYMENT_ID"); id != "" {
			w.Header().Set("ETag", fmt.Sprintf("W/%s", id))
		}
		template.Must(template.ParseFiles("./story/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/make", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Hostname() == "justindfuller.com" {
			http.Redirect(w, r, "https://www.justindfuller.com/make", http.StatusMovedPermanently)

			return
		}

		f, err := os.Open("./make/main.template.html")
		if err != nil {
			http.Error(w, "An error occured.", http.StatusInternalServerError)
			log.Printf("Error opening ./make/main.template.html: %s", err)

			return
		}
		defer func() {
			if err := f.Close(); err != nil {
				log.Printf("Error closing ./make/main.template.html: %s", err)
			}
		}()

		if id := os.Getenv("GAE_DEPLOYMENT_ID"); id != "" {
			w.Header().Set("ETag", fmt.Sprintf("W/%s", id))
		}
		http.ServeContent(w, r, f.Name(), time.Now(), f)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Hostname() == "justindfuller.com" {
			http.Redirect(w, r, "https://www.justindfuller.com", http.StatusMovedPermanently)

			return
		}

		f, err := os.Open("./main.template.html")
		if err != nil {
			http.Error(w, "An error occured.", http.StatusInternalServerError)
			log.Printf("Error opening ./main.template.html: %s", err)

			return
		}
		defer func() {
			if err := f.Close(); err != nil {
				log.Printf("Error closing ./main.template.html: %s", err)
			}
		}()

		if id := os.Getenv("GAE_DEPLOYMENT_ID"); id != "" {
			w.Header().Set("ETag", fmt.Sprintf("W/%s", id))
		}
		http.ServeContent(w, r, f.Name(), time.Now(), f)
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
