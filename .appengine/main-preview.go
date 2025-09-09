package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("Defaulting to port %s", port)
	}

	http.HandleFunc("/", serveStaticFiles)

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func serveStaticFiles(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	path := r.URL.Path
	if path == "/" {
		path = "/index.html"
	}

	// Map URL paths to file paths
	filePath := mapURLToFile(path)
	
	// Try to serve the file
	file, err := os.Open(filePath)
	if err != nil {
		// If file not found, try index.html as fallback
		file, err = os.Open(".build/index.html")
		if err != nil {
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
	}
	defer file.Close()

	// Set content type based on file extension
	setContentType(w, filePath)

	// Serve the file
	io.Copy(w, file)
}

func mapURLToFile(urlPath string) string {
	// Remove leading slash
	urlPath = strings.TrimPrefix(urlPath, "/")
	
	// Handle special cases
	switch {
	case urlPath == "" || urlPath == "index.html":
		return ".build/index.html"
	case strings.HasPrefix(urlPath, "image/"):
		return ".build/" + urlPath
	case strings.HasSuffix(urlPath, ".xml"):
		return ".routes/" + urlPath
	case strings.HasSuffix(urlPath, ".txt"):
		return ".routes/" + urlPath
	case strings.HasSuffix(urlPath, ".webmanifest"):
		return ".build/" + urlPath
	case strings.HasSuffix(urlPath, ".js"):
		return ".build/" + strings.ReplaceAll(urlPath, "/", "-")
	}

	// Handle content pages
	parts := strings.Split(urlPath, "/")
	if len(parts) == 1 {
		// Simple page like /about, /programming, etc.
		return fmt.Sprintf(".build/%s.html", parts[0])
	} else if len(parts) == 2 {
		// Content with ID like /poem/1, /aphorism/2, etc.
		category := parts[0]
		id := parts[1]
		
		// Special cases for content with different naming
		switch category {
		case "story", "review", "thought", "programming", "word", "nature":
			return fmt.Sprintf(".build/%s-%s.html", category, id)
		case "poem", "aphorism":
			return fmt.Sprintf(".build/%s-%s.html", category, id)
		default:
			return fmt.Sprintf(".build/%s-%s.html", category, id)
		}
	}

	// Default fallback
	return ".build/index.html"
}

func setContentType(w http.ResponseWriter, filePath string) {
	ext := filepath.Ext(filePath)
	switch ext {
	case ".html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".xml":
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	case ".txt":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript")
	case ".webmanifest":
		w.Header().Set("Content-Type", "application/manifest+json")
	case ".json":
		w.Header().Set("Content-Type", "application/json")
	case ".css":
		w.Header().Set("Content-Type", "text/css")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
}