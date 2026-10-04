package main

import (
	"bytes"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/justindfuller/justindfuller.com/obsidian"
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
				if route == "/sitemap.xml" {
					name = "sitemap.xml"
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
			wantPolicy := "/*\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n"
			if !indexable {
				wantPolicy = "/*\n  Cache-Control: private, no-store, no-transform\n"
			}
			if !bytes.Contains(headers, []byte(wantPolicy)) {
				t.Errorf("missing artifact preservation policy: %s", headers)
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

func TestPreparedProgrammingCollectionAndPrivateExportBoundary(t *testing.T) {
	git, err := site.LoadProgramming()
	if err != nil || len(git) == 0 {
		t.Fatalf("Git source unavailable: %v", err)
	}
	fixture := func(environment, slug, sync, body string, draft bool) []byte {
		return fmt.Appendf(nil, "---\nenvironment: %s\nsection: programming\nslug: %s\ntitle: Fixture\ndate: 2026-09-20\ndraft: %t\nsync: %s\ntags: [programming]\n---\n%s", environment, slug, draft, sync, body)
	}
	files := map[string][]byte{
		"private.md": fixture("nonprod", "private-canary-post", "add", "NONPROD_SECRET_CANARY", false),
		"public.md":  fixture("production", "public-canary-post", "add", "PUBLIC_POST_CANARY", false),
		"draft.md":   fixture("production", git[0].Slug, "overwrite", "DRAFT_SECRET_CANARY", true),
	}
	source := obsidian.LoadedSource{Snapshot: obsidian.SourceSnapshot{Version: 1, Files: map[string]obsidian.FileRecord{}, Images: map[string]obsidian.ImageRecord{}}, Bodies: files, Ready: map[string]bool{}}
	for name, raw := range files {
		hash := obsidian.SHA256(raw)
		source.Snapshot.Files[name] = obsidian.FileRecord{SHA256: hash, Size: int64(len(raw)), Key: "markdown/v1/" + hash + ".md"}
	}
	canonical, err := obsidian.CanonicalSnapshot(source.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	source.Revision = obsidian.SHA256(canonical)
	for _, mode := range []obsidian.Mode{obsidian.ModeProduction, obsidian.ModeStaging} {
		t.Run(string(mode), func(t *testing.T) {
			prepared, err := obsidian.Prepare(source, obsidian.State{}, git, mode, time.Unix(0, 0))
			if err != nil {
				t.Fatal(err)
			}
			handler, err := site.NewWithPrepared(prepared, mode)
			if err != nil {
				t.Fatal(err)
			}
			for _, route := range []string{"/", "/programming", "/sitemap.xml", "/programming/public-canary-post", "/programming/private-canary-post", "/programming/" + git[0].Slug} {
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
				body := response.Body.String()
				if strings.Contains(body, "DRAFT_SECRET_CANARY") {
					t.Fatal("draft body rendered")
				}
				if mode == obsidian.ModeProduction && strings.Contains(body, "private-canary-post") {
					t.Fatal("nonprod route leaked publicly")
				}
				if route == "/programming/"+git[0].Slug && response.Code != 404 {
					t.Fatal("draft overwrite did not mask Git route")
				}
				if route == "/programming/private-canary-post" && response.Code != map[obsidian.Mode]int{obsidian.ModeProduction: 404, obsidian.ModeStaging: 200}[mode] {
					t.Fatal("post target route mismatch")
				}
				if mode == obsidian.ModeStaging && (!strings.Contains(response.Header().Get("Cache-Control"), "no-store") || !strings.Contains(response.Header().Get("X-Robots-Tag"), "noindex")) {
					t.Fatal("private response boundary missing")
				}
			}
			directory, err := os.MkdirTemp(".", ".overlay-export-test-")
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
			manifest, err := site.ExportWithPrepared(directory, mode == obsidian.ModeProduction, &prepared)
			if err != nil {
				t.Fatal(err)
			}
			var privateRoute bool
			for _, route := range manifest.Pages {
				if route == "/programming/private-canary-post" {
					privateRoute = true
				}
			}
			if privateRoute != (mode != obsidian.ModeProduction) {
				t.Fatal("export collection differs from target")
			}
			exportRoot, err := os.OpenRoot(directory)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := exportRoot.Close(); err != nil {
					t.Error(err)
				}
			})
			err = filepath.WalkDir(directory, func(filename string, entry fs.DirEntry, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}
				if entry.IsDir() {
					return nil
				}
				name, err := filepath.Rel(directory, filename)
				if err != nil {
					return err
				}
				body, err := exportRoot.ReadFile(name)
				if err != nil {
					return err
				}
				if bytes.Contains(body, []byte("DRAFT_SECRET_CANARY")) || mode == obsidian.ModeProduction && (bytes.Contains(body, []byte("NONPROD_SECRET_CANARY")) || bytes.Contains(body, []byte("private-canary-post"))) {
					return fmt.Errorf("excluded content in exported artifact")
				}
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}
