package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/justindfuller/justindfuller.com/site"
)

func TestStaticExportMatchesServer(t *testing.T) {
	for _, indexable := range []bool{false, true} {
		name := "preview"
		if indexable {
			name = "production"
		}
		t.Run(name, func(t *testing.T) {

			directory, err := os.MkdirTemp(".", ".static-test-")
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := os.RemoveAll(directory); err != nil {
					t.Error(err)
				}
			})
			if err := os.Remove(directory); err != nil {
				t.Fatal(err)
			}
			manifest, err := site.Export(directory, indexable)
			if err != nil {
				t.Fatal(err)
			}
			handler, err := site.New()
			if err != nil {
				t.Fatal(err)
			}
			root, err := os.OpenRoot(directory)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := root.Close(); err != nil {
					t.Error(err)
				}
			})
			for _, route := range manifest.Pages {
				name := strings.TrimPrefix(route, "/") + ".html"
				if strings.HasSuffix(route, "/") {
					name = strings.TrimPrefix(route, "/") + "index.html"
				}
				body, err := root.ReadFile(name)
				if err != nil {
					t.Fatal(err)
				}
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
				if response.Code != http.StatusOK || !bytes.Equal(body, response.Body.Bytes()) {
					t.Errorf("export differs from server: %s (%d)", route, response.Code)
				}
			}
			for _, name := range []string{"story/nothing.html", "story/bridge.html", "story/the_philosophy_of_lovers.html", "programming/go-tip-function-arguments.html", "main.go", "go.mod", "programming/2022-12-01_go_tip_function_arguments.md", "cloudflare.config.ts"} {
				if _, err := root.Stat(name); !os.IsNotExist(err) {
					t.Errorf("private or draft file exported: %s (%v)", name, err)
				}
			}
			grass, err := root.ReadFile("grass.html")
			if err != nil {
				t.Fatal(err)
			}
			for _, marker := range []string{"handleReminderClick", "fetch(\"/reminder/set\"", "Notification.requestPermission", "id=\"notifications\""} {
				if bytes.Contains(grass, []byte(marker)) {
					t.Errorf("reminder code remains: %s", marker)
				}
			}
			for _, asset := range manifest.Assets {
				if _, err := root.Stat(strings.TrimPrefix(asset, "/")); err != nil {
					t.Error(err)
				}
			}

			headers, err := root.ReadFile("_headers")
			if err != nil {
				t.Fatal(err)
			}
			if bytes.Contains(headers, []byte("noindex")) == indexable {
				t.Errorf("incorrect indexing headers: %s", headers)
			}
			if !bytes.Contains(headers, []byte("/grass/worker.js\n  Cache-Control: no-store\n")) {
				t.Errorf("missing cleanup cache policy: %s", headers)
			}

		})
	}
}

func TestStaticExportRejectsUnsafeOutput(t *testing.T) {
	for _, directory := range []string{".", "..", "programming", path.Join(t.TempDir(), "output")} {
		if _, err := site.Export(directory, false); err == nil {
			t.Errorf("accepted unsafe output %q", directory)
		}
	}
}

func TestServerRedirectsAndMissingRoutes(t *testing.T) {
	handler, err := site.New()
	if err != nil {
		t.Fatal(err)
	}
	redirects := map[string]string{"/word/": "/word", "/programming/": "/programming", "/about/": "/about", "/make/": "/make", "/poem": "/poem/", "/aphorism": "/aphorism/"}
	for source, target := range redirects {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, source, nil))
		expected := http.StatusMovedPermanently
		if source == "/poem" || source == "/aphorism" {
			expected = http.StatusTemporaryRedirect
		}
		if response.Code != expected || response.Header().Get("Location") != target {
			t.Errorf("redirect %s: %d %s", source, response.Code, response.Header().Get("Location"))
		}
	}
	for _, route := range []string{"/__missing", "/reminder/set", "/reminder/send"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != http.StatusNotFound {
			t.Errorf("missing route %s: %d", route, response.Code)
		}
	}
}
