package main

import (
	"bytes"
	"html/template"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
)

func main() {
	http.HandleFunc("/aphorism", func(w http.ResponseWriter, r *http.Request) {
		var aphorisms = template.Must(template.ParseFiles("./aphorism/main.template.html"))

		file, err := os.ReadFile("./aphorism/entries.txt")
		if err != nil {
			log.Fatalf("Error reading aphorism entries: %s", err)
		}

		split := bytes.Split(file, []byte("\n"))
		for i := len(split) - 1; i >= 0; i-- {
			split[i] = bytes.TrimSpace(split[i])
			if split[i] == nil {
				split = append(split[:i], split[i+1:]...)
			}
		}

		low := 0
		high := len(split) - 1
		for high > low {
			split[low], split[high] = split[high], split[low]
			low++
			high--
		}

		type data struct {
			Entries [][]byte
		}
		aphorisms.Execute(w, data{
			Entries: split,
		})
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		files, err := os.ReadDir("./poem")
		if err != nil {
			log.Fatalf("Error reading poetry entries: %s", err)
		}

		var names []string
		for _, dir := range files {
			if name := dir.Name(); strings.HasSuffix(name, ".md") && !dir.IsDir() {
				names = append(names, name)
			}
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

		contents := make([][]byte, len(names), len(names))
		var wg sync.WaitGroup

		wg.Add(len(names))

		for i, name := range names {
			i := i
			name := name

			go func() {
				defer wg.Done()

				file, err := os.ReadFile("./poem/" + name)
				if err != nil {
					log.Fatalf("Error reading file: %s", err)
				}

				content := file
				content = bytes.Split(content, []byte("```"))[1]
				contents[i] = content
			}()
		}

		wg.Wait()

		low := 0
		high := len(contents) - 1

		for high > low {
			contents[low], contents[high] = contents[high], contents[low]
			low++
			high--
		}

		var poems = template.Must(template.ParseFiles("./poem/main.template.html"))
		type data struct {
			Entries [][]byte
		}
		poems.Execute(w, data{
			Entries: contents,
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
