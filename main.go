package main

import (
	"bytes"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
)

var aphorisms = template.Must(template.ParseFiles("./aphor/main.template.html"))

func main() {
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

	http.HandleFunc("/aphor", func(w http.ResponseWriter, r *http.Request) {
		type data struct {
			Entries [][]byte
		}
		aphorisms.Execute(w, data{
			Entries: split,
		})
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
