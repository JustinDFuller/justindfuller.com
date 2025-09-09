package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("Defaulting to port %s", port)
	}

	// Serve everything through a single handler
	http.HandleFunc("/", serveCachedStaticFiles)

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func serveCachedStaticFiles(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	path := r.URL.Path
	if path == "/" {
		path = "/index.html"
	}

	// Map URL paths to file paths
	filePath := mapURLToFile(path)
	
	// Check if file exists
	file, err := os.Open(filePath)
	if err != nil {
		// If file not found, try index.html as fallback
		file, err = os.Open(".build/index.html")
		if err != nil {
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		// Don't cache 404 fallbacks
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	} else {
		// Set caching headers for successful responses
		setCacheHeaders(w, filePath)
	}
	defer file.Close()

	// Get file info for ETag and Last-Modified
	stat, err := file.Stat()
	if err == nil {
		// Set ETag based on file modification time and size
		etag := fmt.Sprintf(`"%d-%d"`, stat.ModTime().Unix(), stat.Size())
		w.Header().Set("ETag", etag)
		
		// Set Last-Modified header
		w.Header().Set("Last-Modified", stat.ModTime().UTC().Format(http.TimeFormat))
		
		// Check If-None-Match header (ETag validation)
		if match := r.Header.Get("If-None-Match"); match == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		
		// Check If-Modified-Since header
		if modifiedSince := r.Header.Get("If-Modified-Since"); modifiedSince != "" {
			t, err := time.Parse(http.TimeFormat, modifiedSince)
			if err == nil && !stat.ModTime().After(t) {
				w.WriteHeader(http.StatusNotModified)
				return
			}
		}
	}

	// Set content type based on file extension
	setContentType(w, filePath)

	// Serve the file
	io.Copy(w, file)
}

func setCacheHeaders(w http.ResponseWriter, filePath string) {
	ext := filepath.Ext(filePath)
	
	// Different cache strategies based on file type
	switch ext {
	case ".html":
		// HTML files: short cache, must revalidate
		// This ensures users get updates quickly while still benefiting from 304 responses
		w.Header().Set("Cache-Control", "public, max-age=300, must-revalidate")
	case ".css", ".js":
		// CSS/JS: moderate cache
		// If you use versioned/hashed filenames, this could be much longer
		w.Header().Set("Cache-Control", "public, max-age=3600, must-revalidate")
	case ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".webp":
		// Images: long cache (30 days)
		// Images rarely change
		w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
	case ".woff", ".woff2", ".ttf", ".eot":
		// Fonts: very long cache (1 year)
		// Fonts almost never change
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	case ".webmanifest", ".xml", ".txt":
		// Manifests and feeds: short cache
		w.Header().Set("Cache-Control", "public, max-age=3600, must-revalidate")
	default:
		// Default: moderate cache with revalidation
		w.Header().Set("Cache-Control", "public, max-age=3600, must-revalidate")
	}

	// Add Vary header to handle different encodings properly
	w.Header().Set("Vary", "Accept-Encoding")
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
		// RSS feeds are in .routes directory
		if urlPath == "index.xml" {
			return ".routes/" + urlPath
		}
		return ".build/" + urlPath
	case strings.HasSuffix(urlPath, "robots.txt"):
		return ".routes/" + urlPath
	case strings.HasSuffix(urlPath, ".webmanifest"):
		return ".build/" + urlPath
	case strings.HasSuffix(urlPath, ".js"):
		// Service workers have special naming
		if strings.Contains(urlPath, "worker") {
			return ".build/" + strings.ReplaceAll(urlPath, "/", "-")
		}
		return ".build/" + urlPath
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
		return fmt.Sprintf(".build/%s-%s.html", category, id)
	} else if len(parts) == 3 {
		// Nested paths like /2022/01/living-on-24-hours-a-day
		return fmt.Sprintf(".build/%s-%s-%s.html", parts[0], parts[1], parts[2])
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
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".webmanifest":
		w.Header().Set("Content-Type", "application/manifest+json")
	case ".json":
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
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
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	case ".woff":
		w.Header().Set("Content-Type", "font/woff")
	case ".woff2":
		w.Header().Set("Content-Type", "font/woff2")
	case ".ttf":
		w.Header().Set("Content-Type", "font/ttf")
	case ".eot":
		w.Header().Set("Content-Type", "application/vnd.ms-fontobject")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
}