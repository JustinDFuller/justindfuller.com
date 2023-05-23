package main

import (
	"bytes"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	http.HandleFunc("/aphor", func(w http.ResponseWriter, r *http.Request) {
		var aphorisms = template.Must(template.ParseFiles("./aphor/main.template.html"))

		file, err := os.ReadFile("./aphor/entries.txt")
		if err != nil {
			log.Fatalf("Error reading aphor entries: %s", err)
		}

		split := bytes.Split(file, []byte("\n"))
		for i := len(split) - 1; i >= 0; i-- {
			split[i] = bytes.TrimSpace(split[i])
			if split[i] == nil {
				split = append(split[:i], split[i+1:]...)
			}
		}

		type data struct {
			Entries [][]byte
		}
		aphorisms.Execute(w, data{
			Entries: split,
		})
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		dir, err := os.ReadDir("./poem")
		if err != nil {
			log.Fatalf("Error reading poetry entries: %s", err)
		}

		log.Print(dir)
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
