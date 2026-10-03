package site

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/justindfuller/justindfuller.com/aphorism"
	"github.com/justindfuller/justindfuller.com/nature"
	"github.com/justindfuller/justindfuller.com/programming"
	"github.com/justindfuller/justindfuller.com/review"
	"github.com/justindfuller/justindfuller.com/story"
	"github.com/justindfuller/justindfuller.com/thought"
	"golang.org/x/net/html"
)

type Manifest struct {
	Pages  []string `json:"pages"`
	Assets []string `json:"assets"`
}

func PagePaths() ([]string, error) {
	paths := []string{"/", "/about", "/aphorism/", "/word", "/poem/", "/story", "/thought", "/programming", "/review", "/make", "/nature", "/grass", "/kit", "/weeks-remaining"}
	posts, err := programming.GetEntries()
	if err != nil {
		return nil, err
	}
	for _, entry := range posts {
		paths = append(paths, "/programming/"+entry.Slug)
	}
	thoughts, err := thought.GetEntries()
	if err != nil {
		return nil, err
	}
	for _, entry := range thoughts {
		paths = append(paths, "/thought/"+entry.Slug)
	}
	reviews, err := review.GetEntries()
	if err != nil {
		return nil, err
	}
	for _, entry := range reviews {
		paths = append(paths, "/review/"+entry.Slug)
	}
	for _, entry := range story.GetPublishedEntries() {
		paths = append(paths, "/story/"+entry.Slug)
		files, err := os.ReadDir("story")
		if err != nil {
			return nil, err
		}
		for _, file := range files {
			if !file.IsDir() && strings.HasSuffix(file.Name(), "_"+entry.Slug+".md") {
				paths = append(paths, "/story/"+strings.TrimSuffix(file.Name(), ".md"))
			}
		}
	}
	photos, err := nature.Entries()
	if err != nil {
		return nil, err
	}
	for _, entry := range photos {
		if entry.Slug != "" {
			paths = append(paths, "/nature/"+entry.Slug)
		}
	}
	aphorisms, err := aphorism.GetAllEntries()
	if err != nil {
		return nil, err
	}
	for _, entry := range aphorisms {
		paths = append(paths, "/aphorism/"+strconv.Itoa(entry.Number))
	}
	for _, section := range []string{"word", "poem"} {
		files, err := os.ReadDir(section)
		if err != nil {
			return nil, err
		}
		for _, file := range files {
			if file.IsDir() || filepath.Ext(file.Name()) != ".md" {
				continue
			}
			slug := strings.TrimSuffix(file.Name(), ".md")
			if section == "poem" {
				if _, err := strconv.Atoi(slug); err != nil {
					continue
				}
			}
			paths = append(paths, "/"+section+"/"+slug)
		}
	}
	sort.Strings(paths)
	return paths, nil
}

func outputPath(route string) (string, error) {
	if !strings.HasPrefix(route, "/") || path.Clean(route) != strings.TrimSuffix(route, "/") && route != "/" {
		return "", fmt.Errorf("invalid route %q", route)
	}
	if strings.HasSuffix(route, "/") {
		return strings.TrimPrefix(route, "/") + "index.html", nil
	}
	return strings.TrimPrefix(route, "/") + ".html", nil
}

func Export(directory string, indexable bool) (Manifest, error) {
	manifest := Manifest{}
	abs, err := filepath.Abs(directory)
	if err != nil {
		return manifest, err
	}
	working, err := os.Getwd()
	if err != nil {
		return manifest, err
	}
	if abs == working || filepath.Dir(abs) != working {
		return manifest, fmt.Errorf("output must be an immediate child of the repository")
	}
	if _, err := os.Lstat(directory); err == nil {
		return manifest, fmt.Errorf("output already exists: %s", directory)
	} else if !os.IsNotExist(err) {
		return manifest, err
	}
	handler, err := New()
	if err != nil {
		return manifest, err
	}
	pages, err := PagePaths()
	if err != nil {
		return manifest, err
	}
	if err := os.Mkdir(directory, 0o750); err != nil {
		return manifest, err
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		return manifest, err
	}
	defer func() { _ = root.Close() }()
	outputs := map[string]bool{}
	write := func(name string, data []byte) error {
		if outputs[name] {
			return fmt.Errorf("duplicate output %s", name)
		}
		outputs[name] = true
		if err := root.MkdirAll(path.Dir(name), 0o750); err != nil {
			return err
		}
		return root.WriteFile(name, data, 0o640)
	}
	for _, route := range pages {
		name, err := outputPath(route)
		if err != nil {
			return manifest, err
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != http.StatusOK || response.Body.Len() == 0 {
			return manifest, fmt.Errorf("render %s: status %d", route, response.Code)
		}
		if err := write(name, response.Body.Bytes()); err != nil {
			return manifest, err
		}
		manifest.Pages = append(manifest.Pages, route)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/__missing_static_page", nil))
	if response.Code != http.StatusNotFound {
		return manifest, fmt.Errorf("missing page returned %d", response.Code)
	}
	if err := write("404.html", response.Body.Bytes()); err != nil {
		return manifest, err
	}
	sourceRoot, err := os.OpenRoot(".")
	if err != nil {
		return manifest, err
	}
	defer func() { _ = sourceRoot.Close() }()
	for _, directory := range []string{"image", "fonts", "static"} {
		if err := filepath.WalkDir(directory, func(name string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				return nil
			}
			if entry.Type()&os.ModeSymlink != 0 {
				return fmt.Errorf("asset symlink: %s", name)
			}
			switch strings.ToLower(filepath.Ext(name)) {
			case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".css", ".js":
			default:
				return fmt.Errorf("unsupported public asset: %s", name)
			}
			body, err := sourceRoot.ReadFile(name)
			if err != nil {
				return err
			}
			if strings.HasPrefix(string(body), "version https://git-lfs.github.com/spec/") {
				return fmt.Errorf("unresolved LFS asset: %s", name)
			}
			if err := write(filepath.ToSlash(name), body); err != nil {
				return err
			}
			manifest.Assets = append(manifest.Assets, "/"+filepath.ToSlash(name))
			return nil
		}); err != nil {
			return manifest, err
		}
	}
	for source, target := range map[string]string{"site.webmanifest": "site.webmanifest", "make/grass.webmanifest": "grass.webmanifest", "make/grass.worker.js": "grass/worker.js"} {
		body, err := sourceRoot.ReadFile(source)
		if err != nil {
			return manifest, err
		}
		if err := write(target, body); err != nil {
			return manifest, err
		}
		manifest.Assets = append(manifest.Assets, "/"+target)
	}
	redirects := "/about/ /about 301\n/make/ /make 301\n/word/ /word 301\n/programming/ /programming 301\n/poem /poem/ 307\n/aphorism /aphorism/ 307\n"
	if err := write("_redirects", []byte(redirects)); err != nil {
		return manifest, err
	}
	headers := "/grass/worker.js\n  Cache-Control: no-store\n"
	if !indexable {
		headers = "/*\n  X-Robots-Tag: noindex\n" + headers
	}
	if err := write("_headers", []byte(headers)); err != nil {
		return manifest, err
	}
	sort.Strings(manifest.Assets)
	if err := validateLinks(root, manifest); err != nil {
		return manifest, err
	}
	return manifest, nil
}

func validateLinks(root *os.Root, manifest Manifest) error {
	var failures []error
	known := map[string]bool{"/poem": true, "/aphorism": true, "/about/": true, "/make/": true, "/word/": true, "/programming/": true}
	for _, route := range append(append([]string{}, manifest.Pages...), manifest.Assets...) {
		known[route] = true
	}
	cssURL := regexp.MustCompile(`url\(\s*["']?([^"'\s)]+)["']?\s*\)`)
	checkCSS := func(route string, body []byte) {
		base, err := url.Parse("https://static.invalid" + route)
		if err != nil {
			failures = append(failures, err)
			return
		}
		for _, match := range cssURL.FindAllSubmatch(body, -1) {
			link, err := url.Parse(string(match[1]))
			if err != nil {
				failures = append(failures, err)
				continue
			}
			link = base.ResolveReference(link)
			if link.Host == base.Host && !known[link.Path] {
				failures = append(failures, fmt.Errorf("missing CSS asset on %s: %s", route, match[1]))
			}
		}
	}
	for _, asset := range manifest.Assets {
		if path.Ext(asset) == ".css" {
			body, err := root.ReadFile(strings.TrimPrefix(asset, "/"))
			if err != nil {
				return err
			}
			checkCSS(asset, body)
		}
	}
	for _, route := range manifest.Pages {
		name, err := outputPath(route)
		if err != nil {
			return err
		}
		body, err := root.ReadFile(name)
		if err != nil {
			return err
		}
		base, err := url.Parse("https://static.invalid" + route)
		if err != nil {
			return err
		}
		tokens := html.NewTokenizer(strings.NewReader(string(body)))
		inStyle := false
		for {
			tokenType := tokens.Next()
			if tokenType == html.ErrorToken {
				break
			}
			token := tokens.Token()
			if token.Data == "style" {
				switch tokenType {
				case html.StartTagToken:
					inStyle = true
				case html.EndTagToken:
					inStyle = false
				}
			}
			if inStyle && tokenType == html.TextToken {
				checkCSS(route, []byte(token.Data))
			}
			if tokenType != html.StartTagToken && tokenType != html.SelfClosingTagToken {
				continue
			}
			for _, attr := range token.Attr {
				if attr.Key == "style" {
					checkCSS(route, []byte(attr.Val))
				}
				if attr.Key != "src" && attr.Key != "href" {
					continue
				}
				link, err := url.Parse(attr.Val)
				if err != nil {
					return fmt.Errorf("link on %s: %w", route, err)
				}
				link = base.ResolveReference(link)
				if link.Host != base.Host || link.Path == "" {
					continue
				}
				if !known[link.Path] {
					failures = append(failures, fmt.Errorf("missing internal link on %s: %s", route, attr.Val))
				}
			}
		}
	}
	return errors.Join(failures...)
}

func WriteManifest(manifest Manifest, destination string) error {
	body, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o750); err != nil {
		return err
	}
	return os.WriteFile(destination, append(body, '\n'), 0o600)
}
