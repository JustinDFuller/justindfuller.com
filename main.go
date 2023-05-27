package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

func aphorisms() ([][]byte, error) {
	file, err := os.ReadFile("./aphorism/entries.txt")
	if err != nil {
		return nil, errors.Wrap(err, "error reading aphorisms entries.txt")
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

	return split, nil
}

func poems() ([][]byte, error) {
	files, err := os.ReadDir("./poem")
	if err != nil {
		return nil, errors.Wrap(err, "error reading poetry entries")
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
	var wg errgroup.Group

	for i, name := range names {
		i := i
		name := name

		wg.Go(func() error {
			path := fmt.Sprintf("./poem/%s", name)

			file, err := os.ReadFile(path)
			if err != nil {
				return errors.Wrapf(err, "error reading file: %s", path)
			}

			content := file
			content = bytes.Split(content, []byte("```"))[1]
			contents[i] = content

			return nil
		})
	}

	if err := wg.Wait(); err != nil {
		return nil, errors.Wrap(err, "Error reading poems")
	}

	low := 0
	high := len(contents) - 1

	for high > low {
		contents[low], contents[high] = contents[high], contents[low]
		low++
		high--
	}

	return contents, nil
}

func stories() ([][]byte, error) {
	files, err := os.ReadDir("./story")
	if err != nil {
		return nil, errors.Wrap(err, "error reading story directory")
	}

	var names []string
	for _, dir := range files {
		if name := dir.Name(); strings.HasSuffix(name, ".md") && !dir.IsDir() {
			names = append(names, name)
		}
	}

	contents := make([][]byte, len(names), len(names))
	var wg errgroup.Group

	for i, name := range names {
		i := i
		name := name

		wg.Go(func() error {
			path := fmt.Sprintf("./story/%s", name)

			file, err := os.ReadFile(path)
			if err != nil {
				return errors.Wrapf(err, "error reading story: %s", path)
			}

			lines := bytes.Split(file, []byte("\n"))

			for i := len(lines) - 1; i >= 0; i-- {
				lines[i] = bytes.TrimSpace(lines[i])
				if lines[i] == nil || bytes.Equal(lines[i], []byte("\n")) {
					lines = append(lines[:i], lines[i+1:]...)
				}
			}

			for i, line := range lines {
				if bytes.HasPrefix(line, []byte("<h")) {
					continue
				}

				if line == nil || bytes.Equal(line, []byte("\n")) {
					continue
				}

				lines[i] = append([]byte("<p>"), line...)
				lines[i] = append(lines[i], []byte("</p>")...)
			}

			contents[i] = bytes.Join(lines, nil)

			return nil
		})
	}

	if err := wg.Wait(); err != nil {
		return nil, errors.Wrap(err, "error reading stories")
	}

	low := 0
	high := len(contents) - 1

	for high > low {
		contents[low], contents[high] = contents[high], contents[low]
		low++
		high--
	}

	return contents, nil
}

type data struct {
	Entries [][]byte
}

func main() {
	http.HandleFunc("/aphorism", func(w http.ResponseWriter, r *http.Request) {
		entries, err := aphorisms()
		if err != nil {
			http.Error(w, "Error reading Aphorisms", http.StatusInternalServerError)
			log.Printf("Error reading Aphorisms: %s", err)

			return
		}

		template.Must(template.ParseFiles("./aphorism/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/poem", func(w http.ResponseWriter, r *http.Request) {
		entries, err := poems()
		if err != nil {
			http.Error(w, "Error reading poems.", http.StatusInternalServerError)
			log.Printf("Error reading poems.")

			return
		}

		template.Must(template.ParseFiles("./poem/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/story", func(w http.ResponseWriter, r *http.Request) {
		entries, err := stories()
		if err != nil {
			http.Error(w, "Error reading stories.", http.StatusInternalServerError)
			log.Printf("Error reading stories: %s", err)

			return
		}

		template.Must(template.ParseFiles("./story/main.template.html")).Execute(w, data{
			Entries: entries,
		})
	})

	http.HandleFunc("/make", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./make/main.template.html")
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
