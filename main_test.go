package main

import (
	"bytes"
	"fmt"
	"html"
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
	"github.com/justindfuller/justindfuller.com/programming"
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

func previewHead(t *testing.T, handler http.Handler, route string) string {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
	if response.Code != http.StatusOK {
		t.Fatalf("%s: %d", route, response.Code)
	}
	body := response.Body.String()
	end := strings.Index(body, "</head>")
	if end < 0 {
		t.Fatalf("%s has no head", route)
	}
	return body[:end]
}

func TestProgrammingPreviewTags(t *testing.T) {
	git, err := site.LoadProgramming()
	if err != nil || len(git) == 0 {
		t.Fatalf("Git source unavailable: %v", err)
	}
	handler, err := site.New()
	if err != nil {
		t.Fatal(err)
	}
	withImage, withoutImage := -1, -1
	for index, entry := range git {
		if _, found := programming.FirstImage(entry.Content); found && withImage < 0 {
			withImage = index
		}
		if _, found := programming.FirstImage(entry.Content); !found && withoutImage < 0 {
			withoutImage = index
		}
	}
	if withImage < 0 || withoutImage < 0 {
		t.Fatal("expected Git posts with and without images")
	}

	first, _ := programming.FirstImage(git[withImage].Content)
	head := previewHead(t, handler, "/programming/"+git[withImage].Slug)
	if strings.Count(head, `property="og:image"`) != 1 || strings.Count(head, `name="twitter:card" content="summary_large_image"`) != 1 {
		t.Fatalf("expected one og:image and one twitter:card:\n%s", head)
	}
	if !strings.Contains(head, `property="og:image" content="`+html.EscapeString(absolute(first.Src))+`"`) {
		t.Fatalf("og:image does not match the first body image %q:\n%s", first.Src, head)
	}
	if first.Alt != "" && !strings.Contains(head, `property="og:image:alt" content="`+html.EscapeString(first.Alt)+`"`) {
		t.Fatalf("og:image:alt missing:\n%s", head)
	}

	noImage := "/programming/" + git[withoutImage].Slug
	for _, route := range []string{"/", "/programming", "/about", "/poem/", noImage} {
		head := previewHead(t, handler, route)
		for _, tag := range []string{"og:image", "twitter:card"} {
			if strings.Contains(head, tag) {
				t.Errorf("%s declares %s:\n%s", route, tag, head)
			}
		}
	}
}

func absolute(src string) string {
	if strings.HasPrefix(src, "/") {
		return "https://www.justindfuller.com" + src
	}
	return src
}

func TestObsidianPreviewImageValue(t *testing.T) {
	git, err := site.LoadProgramming()
	if err != nil || len(git) == 0 {
		t.Fatalf("Git source unavailable: %v", err)
	}
	record := obsidian.ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	other := obsidian.ImageRecord{SHA256: strings.Repeat("c", 64), MD5: strings.Repeat("d", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("c", 64) + ".png"}
	fixture := func(slug, image, body string) []byte {
		line := ""
		if image != "" {
			line = "image: " + image + "\n"
		}
		return fmt.Appendf(nil, "---\nenvironment: production\nsection: programming\nslug: %s\ntitle: Fixture\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: [programming]\n%s---\n%s", slug, line, body)
	}
	files := map[string][]byte{
		"cover.md":    fixture("cover-post", "image/cover.png", "![Body \"alt\" & more](image/body.png)"),
		"fallback.md": fixture("fallback-post", "image/missing.png", "![Body alt](image/body.png)"),
		"nobody.md":   fixture("cover-only-post", "image/cover.png", "No images in this body"),
	}
	source := obsidian.LoadedSource{Snapshot: obsidian.SourceSnapshot{Version: 1, Files: map[string]obsidian.FileRecord{}, Images: map[string]obsidian.ImageRecord{"image/cover.png": record, "image/body.png": other}}, Bodies: files, Ready: map[string]bool{record.Key: true, other.Key: true}}
	for name, raw := range files {
		hash := obsidian.SHA256(raw)
		source.Snapshot.Files[name] = obsidian.FileRecord{SHA256: hash, Size: int64(len(raw)), Key: "markdown/v1/" + hash + ".md"}
	}
	canonical, err := obsidian.CanonicalSnapshot(source.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	source.Revision = obsidian.SHA256(canonical)
	prepared, err := obsidian.Prepare(source, obsidian.State{}, git, obsidian.ModeProduction, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	handler, err := site.NewWithPrepared(prepared, obsidian.ModeProduction)
	if err != nil {
		t.Fatal(err)
	}
	cover := "https://media.justindfuller.com/" + record.Key
	body := "https://media.justindfuller.com/" + other.Key

	head := previewHead(t, handler, "/programming/cover-post")
	if strings.Count(head, `property="og:image"`) != 1 || !strings.Contains(head, `property="og:image" content="`+cover+`"`) {
		t.Fatalf("image value not declared:\n%s", head)
	}
	if strings.Contains(head, "og:image:alt") || strings.Count(head, `name="twitter:card" content="summary_large_image"`) != 1 {
		t.Fatalf("companion tags wrong for an image not used in the body:\n%s", head)
	}

	head = previewHead(t, handler, "/programming/fallback-post")
	if !strings.Contains(head, `property="og:image" content="`+body+`"`) || !strings.Contains(head, `property="og:image:alt" content="Body alt"`) {
		t.Fatalf("bad image value did not fall back to the first body image:\n%s", head)
	}

	head = previewHead(t, handler, "/programming/cover-only-post")
	if !strings.Contains(head, `property="og:image" content="`+cover+`"`) {
		t.Fatalf("image value not declared for a post with no body images:\n%s", head)
	}
}

func TestPreviewAltTextIsEscaped(t *testing.T) {
	record := obsidian.ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	raw := []byte("---\nenvironment: production\nsection: programming\nslug: escaped-post\ntitle: Fixture\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: [programming]\n---\n![Say \"hi\" & 'bye'](image/body.png)")
	source := obsidian.LoadedSource{Snapshot: obsidian.SourceSnapshot{Version: 1, Files: map[string]obsidian.FileRecord{}, Images: map[string]obsidian.ImageRecord{"image/body.png": record}}, Bodies: map[string][]byte{"p.md": raw}, Ready: map[string]bool{record.Key: true}}
	hash := obsidian.SHA256(raw)
	source.Snapshot.Files["p.md"] = obsidian.FileRecord{SHA256: hash, Size: int64(len(raw)), Key: "markdown/v1/" + hash + ".md"}
	canonical, err := obsidian.CanonicalSnapshot(source.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	source.Revision = obsidian.SHA256(canonical)
	prepared, err := obsidian.Prepare(source, obsidian.State{}, nil, obsidian.ModeProduction, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	handler, err := site.NewWithPrepared(prepared, obsidian.ModeProduction)
	if err != nil {
		t.Fatal(err)
	}
	head := previewHead(t, handler, "/programming/escaped-post")
	if !strings.Contains(head, `property="og:image:alt" content="Say &#34;hi&#34; &amp; &#39;bye&#39;"`) {
		t.Fatalf("alt text not escaped as an attribute:\n%s", head)
	}
}
