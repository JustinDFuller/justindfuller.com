package obsidian

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
	"golang.org/x/oauth2"
	"google.golang.org/api/googleapi"
)

type memorySource struct {
	tree        SourceTree
	content     map[string][]byte
	downloadErr map[string]error
	readErr     error
	readStarted chan struct{}
	readWait    chan struct{}
	readOnce    sync.Once
}

func (m *memorySource) Read(context.Context, string) (SourceTree, error) {
	if m.readStarted != nil {
		m.readOnce.Do(func() { close(m.readStarted) })
	}
	if m.readWait != nil {
		<-m.readWait
	}
	if m.readErr != nil {
		return SourceTree{}, m.readErr
	}
	return m.tree, nil
}

func (m *memorySource) Download(_ context.Context, fileID string) ([]byte, error) {
	if err := m.downloadErr[fileID]; err != nil {
		return nil, err
	}
	return m.content[fileID], nil
}

func fixedConfig(source Source, environment Environment) Config {
	return Config{
		FolderID:      "folder",
		Environment:   environment,
		SyncInterval:  time.Second,
		SourceFactory: func(context.Context) (Source, error) { return source, nil },
		EventLogger:   func(Event) {},
	}
}

func markdown(slug, environment, mode string, body string) []byte {
	return []byte("---\n" +
		"environment: " + environment + "\n" +
		"section: programming\n" +
		"slug: " + slug + "\n" +
		"title: Test Post\n" +
		"date: 2026-09-20\n" +
		"draft: false\n" +
		"sync: " + mode + "\n" +
		"tags:\n  - test\n" +
		"---\n" + body)
}

func file(id, name, path string) RemoteFile {
	return RemoteFile{ID: id, Name: name, Path: path, Revision: "1"}
}

func validPNG() []byte {
	data, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	if err != nil {
		panic(err)
	}
	return data
}

func validJPEG() []byte {
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, 1, 1)), nil); err != nil {
		panic(err)
	}
	return buffer.Bytes()
}

type blockingSource struct{}

func (blockingSource) Read(ctx context.Context, _ string) (SourceTree, error) {
	<-ctx.Done()
	return SourceTree{}, ctx.Err()
}

func (blockingSource) Download(context.Context, string) ([]byte, error) {
	return nil, context.DeadlineExceeded
}

func TestStoreAddsValidEntryAndRewritesImage(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram.png", "image/nested/diagram.png"),
		}},
		content: map[string][]byte{
			"post":  markdown("external-post", "local", "add", "![[nested/diagram.png|Diagram]]"),
			"image": validPNG(),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))

	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "external-post" {
		t.Fatalf("entries = %#v", entries)
	}
	if !strings.Contains(string(entries[0].Content), "/__obsidian/image/") {
		t.Fatalf("content did not contain rewritten image URL: %s", entries[0].Content)
	}

	start := strings.Index(string(entries[0].Content), "/__obsidian/image/") + len("/__obsidian/image/")
	end := strings.IndexAny(string(entries[0].Content)[start:], "\"' >)")
	token := string(entries[0].Content)[start : start+end]
	asset, ok := store.Image(context.Background(), token, nil)
	if !ok || string(asset.Data) != string(validPNG()) {
		t.Fatalf("asset = %#v, ok = %v", asset, ok)
	}
}

func TestLocalDriveSourceUsesKeychainOAuthCredentials(t *testing.T) {
	var gotAccount string
	var gotService string
	source, err := newDriveSource(context.Background(), Config{
		Environment:                EnvironmentLocal,
		GoogleOAuthKeychainAccount: "test-account",
		GoogleOAuthKeychainService: "test-service",
		KeychainReader: func(_ context.Context, account, service string) (string, error) {
			gotAccount = account
			gotService = service
			return `{"type":"authorized_user","client_id":"client-id","client_secret":"client-secret","refresh_token":"refresh-token"}`, nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if source == nil {
		t.Fatal("source is nil")
	}
	if gotAccount != "test-account" || gotService != "test-service" {
		t.Fatalf("Keychain lookup = %q/%q", gotAccount, gotService)
	}
}

func TestLocalDriveSourceRejectsServiceAccountCredentials(t *testing.T) {
	_, err := newDriveSource(context.Background(), Config{
		Environment: EnvironmentLocal,
		KeychainReader: func(context.Context, string, string) (string, error) {
			return `{"type":"service_account","client_email":"service@example.com","private_key":"private-key"}`, nil
		},
	})
	if err == nil || !errors.Is(err, errInvalidSourceConfiguration) {
		t.Fatalf("error = %v", err)
	}
}

func TestLocalDriveSourceRejectsMalformedKeychainCredentials(t *testing.T) {
	_, err := newDriveSource(context.Background(), Config{
		Environment: EnvironmentLocal,
		KeychainReader: func(context.Context, string, string) (string, error) {
			return "not-json", nil
		},
	})
	if err == nil || !errors.Is(err, errInvalidSourceConfiguration) {
		t.Fatalf("error = %v", err)
	}
}

func TestInvalidMarkdownDoesNotBlockValidPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("bad", "bad.md", "bad.md"),
			file("good", "good.md", "good.md"),
		}},
		content: map[string][]byte{
			"bad":  []byte("---\ntitle: missing required fields\n---\nbody"),
			"good": markdown("good-post", "local", "add", "Good body"),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))

	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].FileID != "bad" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestUnsupportedRootLayoutIsolatedFromValidPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("text", "notes.txt", "notes.txt"),
			{ID: "folder", Name: "notes", Path: "notes", IsFolder: true, Revision: "1"},
			file("good", "good.md", "good.md"),
		}},
		content:     map[string][]byte{"good": markdown("good-post", "local", "add", "Good body")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 2 {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
	for _, issue := range diagnostics.Issues {
		if issue.Category != "source_layout" {
			t.Fatalf("issues = %#v", diagnostics.Issues)
		}
	}
}

func TestInvalidMetadataRevisionsDoNotBlockValidPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("unknown", "unknown.md", "unknown.md"),
			file("tags", "tags.md", "tags.md"),
			file("good", "good.md", "good.md"),
		}},
		content: map[string][]byte{
			"unknown": []byte("---\nenvironment: local\nsection: programming\nslug: unknown\ntitle: Unknown\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: [test]\nextra: true\n---\nbody"),
			"tags":    []byte("---\nenvironment: local\nsection: programming\nslug: tags\ntitle: Tags\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: test\n---\nbody"),
			"good":    markdown("good-post", "local", "add", "Good body"),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 2 {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestIndependentErrorsDoNotBlockValidContent(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("bad-markdown", "bad.md", "bad.md"),
			file("bad-image-post", "bad-image.md", "bad-image.md"),
			file("bad-image", "bad.png", "image/bad.png"),
			file("good-post", "good.md", "good.md"),
			file("good-image", "good.png", "image/good.png"),
		}},
		content: map[string][]byte{
			"bad-markdown":   []byte("---\ntitle: invalid\n---\nbody"),
			"bad-image-post": markdown("bad-image-post", "local", "add", "Before\n\n![Bad](image/bad.png)\n\nAfter"),
			"bad-image":      []byte("not an image"),
			"good-post":      markdown("good-post", "local", "add", "Good body\n\n![Good](image/good.png)"),
			"good-image":     validPNG(),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 2 {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	categories := make(map[string]bool)
	for _, issue := range diagnostics.Issues {
		categories[issue.Category] = true
	}
	if !categories["markdown_metadata"] || !categories["image_validation"] || len(diagnostics.Issues) != 2 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestInvalidImageOnlyOmitsImage(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram.png", "image/diagram.png"),
		}},
		content: map[string][]byte{
			"post": markdown("external-post", "local", "add", "Before\n\n![Diagram](image/diagram.png)\n\nAfter"),
		},
		downloadErr: map[string]error{"image": &googleapi.Error{Code: 503}},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))

	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(string(entries[0].Content), "<img") {
		t.Fatalf("entries = %#v", entries)
	}
	if !strings.Contains(string(entries[0].Content), "Before") || !strings.Contains(string(entries[0].Content), "After") {
		t.Fatalf("post body was not retained: %s", entries[0].Content)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "image_download" || diagnostics.Issues[0].Route != "external-post" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestInvalidImageBytesOnlyOmitImage(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram.png", "image/diagram.png"),
		}},
		content: map[string][]byte{
			"post":  markdown("external-post", "local", "add", "Before\n\n![Diagram](image/diagram.png)\n\nAfter"),
			"image": validPNG()[:len(validPNG())-2],
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(string(entries[0].Content), "<img") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "image_validation" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestSupportedJPEGAndSVGImagesAreServed(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("jpeg", "photo.jpg", "image/photos/photo.jpg"),
			file("svg", "icon.svg", "image/icons/icon.svg"),
		}},
		content: map[string][]byte{
			"post": []byte("---\nenvironment: local\nsection: programming\nslug: external-post\ntitle: Test Post\ndate: 2026-09-20\ndraft: false\nsync: add\ntags:\n  - test\n---\n![Photo](image/photos/photo.jpg)\n\n![Icon](image/icons/icon.svg)"),
			"jpeg": validJPEG(),
			"svg":  []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>`),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Count(string(entries[0].Content), "/__obsidian/image/") != 2 {
		t.Fatalf("entries = %#v", entries)
	}
	contentTypes := make(map[string]bool)
	for _, asset := range store.current.Images {
		contentTypes[asset.ContentType] = true
	}
	if !contentTypes["image/jpeg"] || !contentTypes["image/svg+xml"] {
		t.Fatalf("content types = %#v", contentTypes)
	}
}

func TestMarkdownImageDestinationWithTitleIsServed(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram.png", "image/nested/diagram.png"),
		}},
		content: map[string][]byte{
			"post":  markdown("external-post", "local", "add", `![Diagram](<image/nested/diagram.png> "Title")`),
			"image": validPNG(),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "/__obsidian/image/") {
		t.Fatalf("entries = %#v", entries)
	}
}

func TestMarkdownImageDestinationWithParenthesesIsServed(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram(1).png", "image/nested/diagram(1).png"),
		}},
		content: map[string][]byte{
			"post":  markdown("external-post", "local", "add", `![Diagram](image/nested/diagram(1).png)`),
			"image": validPNG(),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "/__obsidian/image/") {
		t.Fatalf("entries = %#v", entries)
	}
	if diagnostics := store.Diagnostics(context.Background(), nil); len(diagnostics.Issues) != 0 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestMarkdownImageDestinationWithEscapedParenthesesIsServed(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram(2).png", "image/nested/diagram(2).png"),
		}},
		content: map[string][]byte{
			"post":  markdown("external-post", "local", "add", `![Diagram](image/nested/diagram\(2\).png)`),
			"image": validPNG(),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "/__obsidian/image/") {
		t.Fatalf("entries = %#v", entries)
	}
	if diagnostics := store.Diagnostics(context.Background(), nil); len(diagnostics.Issues) != 0 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestMarkdownImagesInCodeArePreserved(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md"), file("image", "diagram.png", "image/diagram.png")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "```markdown\n![Diagram](image/diagram.png)\n```"), "image": validPNG()},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(string(entries[0].Content), "/__obsidian/image/") || !strings.Contains(string(entries[0].Content), "image/diagram.png") {
		t.Fatalf("entries = %#v", entries)
	}
	if diagnostics := store.Diagnostics(context.Background(), nil); len(diagnostics.Issues) != 0 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestMultilineInlineCodeIsPreserved(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "`![Not an image](image.png\n)`")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "Not an image") {
		t.Fatalf("entries = %#v", entries)
	}
	if diagnostics := store.Diagnostics(context.Background(), nil); len(diagnostics.Issues) != 0 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestMalformedAngleImageInvalidatesOnlyPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{file("bad", "bad.md", "bad.md"), file("good", "good.md", "good.md")}},
		content: map[string][]byte{
			"bad":  markdown("bad-post", "local", "add", `![Bad](<image/diagram.png)`),
			"good": markdown("good-post", "local", "add", "Good body"),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "markdown_image_syntax" {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestMultilineRawHTMLImageIsOmitted(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "Before\n\n<img\n  src=\"https://example.com/image.png\">\n\nAfter")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(string(entries[0].Content), "example.com/image.png") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "image_reference_outside_source" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestObsidianSyntaxInCodeIsPreserved(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "```text\n[[example]]\n%%example%%\n```\n\n    [[indented]]")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "example") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 0 {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestDraftAdditiveEntryIsExcludedFromRoutesAndSitemap(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": []byte(strings.Replace(string(markdown("draft-post", "local", "add", "Draft body")), "draft: false", "draft: true", 1))},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 0 {
		t.Fatalf("entries = %#v", entries)
	}
	resolution := store.Resolve(context.Background(), "draft-post", nil, func() (programming.Entry, error) {
		return programming.Entry{}, errors.New("local post should not load")
	})
	if !resolution.Masked || resolution.Found {
		t.Fatalf("resolution = %#v", resolution)
	}
	sitemap, err := BuildSitemap(FallbackSitemap(), entries, "https://justindfuller.com")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(sitemap), "/programming/draft-post") {
		t.Fatalf("sitemap = %s", sitemap)
	}
}

func TestRawHTMLImagesInCodeArePreserved(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "```html\n<img src=\"https://example.com/image.png\">\n```\n\n`<img src=\"https://example.com/inline.png\">`")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "example.com/image.png") || !strings.Contains(string(entries[0].Content), "example.com/inline.png") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 0 {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestExternalMetadataIsHTMLSafe(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": []byte("---\nenvironment: local\nsection: programming\nslug: external-post\ntitle: \"<script>alert(1)</script>\"\nsubtitle: \"<b>subtitle</b>\"\ndate: 2026-09-20\ndraft: false\nsync: add\ntags:\n  - test\n---\nbody")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(entries[0].Title, "<script>") || strings.Contains(entries[0].SubTitle, "<b>") {
		t.Fatalf("entries = %#v", entries)
	}
	if !strings.Contains(entries[0].Title, "&lt;script&gt;") || !strings.Contains(entries[0].SubTitle, "&lt;b&gt;") {
		t.Fatalf("escaped metadata = %#v", entries[0])
	}
}

func TestMalformedImageSyntaxInvalidatesOnlyPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("bad", "bad.md", "bad.md"),
			file("good", "good.md", "good.md"),
		}},
		content: map[string][]byte{
			"bad":  markdown("bad-post", "local", "add", "Before\n\n![broken image.png)"),
			"good": markdown("good-post", "local", "add", "Good body"),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "markdown_image_syntax" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestRawHTMLImageIsOmittedWithoutBlockingPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content: map[string][]byte{
			"post": markdown("external-post", "local", "add", `Before\n\n<img src="https://example.com/image.png">\n\nAfter`),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || strings.Contains(string(entries[0].Content), "<img") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "image_reference_outside_source" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestEnvironmentPromotionMatrix(t *testing.T) {
	for _, test := range []struct {
		environment Environment
		active      Environment
		want        bool
	}{
		{EnvironmentProduction, EnvironmentProduction, true},
		{EnvironmentProduction, EnvironmentPreview, true},
		{EnvironmentProduction, EnvironmentLocal, true},
		{EnvironmentPreview, EnvironmentProduction, false},
		{EnvironmentPreview, EnvironmentPreview, true},
		{EnvironmentPreview, EnvironmentLocal, true},
		{EnvironmentLocal, EnvironmentProduction, false},
		{EnvironmentLocal, EnvironmentPreview, false},
		{EnvironmentLocal, EnvironmentLocal, true},
	} {
		source := &memorySource{
			tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
			content:     map[string][]byte{"post": markdown("post", string(test.environment), "add", "body")},
			downloadErr: map[string]error{},
		}
		store := NewStore(fixedConfig(source, test.active))
		entries := store.Entries(context.Background(), nil)
		if test.active == EnvironmentProduction {
			deadline := time.Now().Add(time.Second)
			for len(entries) != 1 && time.Now().Before(deadline) {
				time.Sleep(10 * time.Millisecond)
				entries = store.Entries(context.Background(), nil)
			}
		}
		if got := len(entries) == 1; got != test.want {
			t.Errorf("file environment=%s active=%s: got %v, want %v", test.environment, test.active, got, test.want)
		}
	}
}

func TestSourceFailureRetainsLastKnownGoodAndMarksStale(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}

	source.readErr = errors.New("temporary source outage")
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "post" {
		t.Fatalf("fallback entries = %#v diagnostics = %#v", entries, store.Diagnostics(context.Background(), nil))
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if !diagnostics.Status.Stale || diagnostics.Status.State != "degraded" {
		t.Fatalf("status = %#v", diagnostics.Status)
	}
}

func TestProductionSyncDoesNotBlockContentRequests(t *testing.T) {
	readStarted := make(chan struct{})
	readWait := make(chan struct{})
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "prd", "add", "body")},
		downloadErr: map[string]error{},
		readStarted: readStarted,
		readWait:    readWait,
	}
	store := NewStore(fixedConfig(source, EnvironmentProduction))
	started := time.Now()
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 0 || time.Since(started) > 100*time.Millisecond {
		t.Fatalf("production request was blocked: entries=%#v duration=%s", entries, time.Since(started))
	}
	select {
	case <-readStarted:
	case <-time.After(time.Second):
		t.Fatal("background synchronization did not start")
	}
	close(readWait)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		entries = store.Entries(context.Background(), nil)
		if len(entries) == 1 && entries[0].Slug == "post" {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("background entries = %#v", entries)
}

func TestProductionSourceInitializationDoesNotBlockContentRequests(t *testing.T) {
	factoryStarted := make(chan struct{})
	releaseFactory := make(chan struct{})
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "prd", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentProduction)
	config.SourceFactory = func(context.Context) (Source, error) {
		close(factoryStarted)
		<-releaseFactory
		return source, nil
	}
	store := NewStore(config)
	store.Entries(context.Background(), nil)
	select {
	case <-factoryStarted:
	case <-time.After(time.Second):
		t.Fatal("source initialization did not start")
	}
	requestDone := make(chan struct{})
	go func() {
		store.Diagnostics(context.Background(), nil)
		close(requestDone)
	}()
	select {
	case <-requestDone:
	case <-time.After(100 * time.Millisecond):
		close(releaseFactory)
		t.Fatal("content request blocked during source initialization")
	}
	close(releaseFactory)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if entries := store.Entries(context.Background(), nil); len(entries) == 1 && entries[0].Slug == "post" {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("background synchronization did not publish the source entry")
}

func TestSourceFailureCategories(t *testing.T) {
	if category, ok := sourceDownloadFailureCategory(io.ErrUnexpectedEOF); !ok || category != "transient_source_failure" {
		t.Fatalf("unexpected EOF download category = %q, %v", category, ok)
	}
	if category, ok := sourceDownloadFailureCategory(errors.New("generic transport failure")); !ok || category != "transient_source_failure" {
		t.Fatalf("generic download category = %q, %v", category, ok)
	}
	if category := sourceFailureCategory(errors.New("temporary network failure")); category != "transient_source_failure" {
		t.Fatalf("generic error category = %q", category)
	}
	if category := sourceFailureCategory(&googleapi.Error{Code: 403}); category != "configuration_or_authorization_failure" {
		t.Fatalf("authorization error category = %q", category)
	}
	if category := sourceFailureCategory(&googleapi.Error{Code: 408}); category != "transient_source_failure" {
		t.Fatalf("timeout error category = %q", category)
	}
	if category := sourceFailureCategory(errInvalidSourceConfiguration); category != "configuration_or_authorization_failure" {
		t.Fatalf("configuration error category = %q", category)
	}
	if category := sourceFailureCategory(&oauth2.RetrieveError{ErrorCode: "invalid_grant"}); category != "configuration_or_authorization_failure" {
		t.Fatalf("OAuth error category = %q", category)
	}
	if category := sourceFailureCategory(&oauth2.RetrieveError{Response: &http.Response{StatusCode: 500}}); category != "transient_source_failure" {
		t.Fatalf("OAuth server error category = %q", category)
	}
	if category := sourceFailureCategory(&googleapi.Error{Code: 403, Errors: []googleapi.ErrorItem{{Reason: "rateLimitExceeded"}}}); category != "transient_source_failure" {
		t.Fatalf("rate-limit error category = %q", category)
	}
}

func TestMarkdownDownloadSourceFailureRetainsLastKnownGood(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}
	source.downloadErr["post"] = errors.New("generic transport failure")
	source.tree.Files[0].Revision = "2"
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "post" {
		t.Fatalf("fallback entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if diagnostics.Status.State != "degraded" || !diagnostics.Status.Stale || len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Category != "transient_source_failure" {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestPreviewSyncUsesConfiguredTimeout(t *testing.T) {
	config := fixedConfig(blockingSource{}, EnvironmentPreview)
	config.SyncTimeout = 20 * time.Millisecond
	store := NewStore(config)
	done := make(chan struct{})
	go func() {
		store.Entries(context.Background(), nil)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("preview synchronization exceeded its configured timeout")
	}
}

func TestEventLoggerCanInspectStoreDuringSynchronization(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	var store *Store
	config := fixedConfig(source, EnvironmentLocal)
	config.EventLogger = func(Event) {
		if store != nil {
			store.Diagnostics(context.Background(), nil)
		}
	}
	store = NewStore(config)
	done := make(chan struct{})
	go func() {
		store.Entries(context.Background(), nil)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("event callback blocked synchronization")
	}
}

func TestLocalDraftRouteIsNotResolved(t *testing.T) {
	store := NewStore(fixedConfig(&memorySource{readErr: errors.New("source unavailable")}, EnvironmentLocal))
	resolution := store.Resolve(context.Background(), "draft", []programming.Entry{{Slug: "draft", IsDraft: true}}, func() (programming.Entry, error) {
		return programming.Entry{Slug: "draft", IsDraft: true}, nil
	})
	if resolution.Found || resolution.Masked {
		t.Fatalf("resolution = %#v", resolution)
	}
}

func TestEnvironmentIneligibleFileIsIgnoredInDiagnostics(t *testing.T) {
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentPreview))
	store.Entries(context.Background(), nil)
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Files) != 1 || diagnostics.Files[0].State != "ignored" {
		t.Fatalf("files = %#v", diagnostics.Files)
	}
}

func TestBuildSitemapPreservesBaseAndAddsProgrammingEntries(t *testing.T) {
	slashes := string([]byte{47, 47})
	site := "https:" + slashes + "justindfuller.com"
	base := []byte("<?xml version=\"1.0\"?><urlset xmlns=\"http:" + slashes + "www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>" + site + "/</loc></url><url><loc>" + site + "/programming/local-post</loc></url></urlset>")
	entries := []programming.Entry{{Slug: "external-post", Date: time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)}}
	sitemap, err := BuildSitemap(base, entries, site)
	if err != nil {
		t.Fatal(err)
	}
	result := string(sitemap)
	if !strings.Contains(result, site+"/") || !strings.Contains(result, site+"/programming/external-post") || strings.Contains(result, "programming/local-post") {
		t.Fatalf("sitemap = %s", result)
	}
}

func TestOverwriteAndDraftMaskLocalRoute(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("local-post", "local", "overwrite", "external body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	local := programming.Entry{Slug: "local-post", Title: "Local", Date: now}
	entries := store.Entries(context.Background(), []programming.Entry{local})
	if len(entries) != 1 || entries[0].Title != "Test Post" {
		t.Fatalf("overwrite entries = %#v", entries)
	}

	draft := strings.Replace(string(source.content["post"]), "draft: false", "draft: true", 1)
	source.content["post"] = []byte(draft)
	source.tree.Files[0].Revision = "2"
	now = now.Add(2 * time.Second)
	entries = store.Entries(context.Background(), []programming.Entry{local})
	if len(entries) != 0 {
		t.Fatalf("draft overwrite entries = %#v", entries)
	}
	resolution := store.Resolve(context.Background(), "local-post", []programming.Entry{local}, func() (programming.Entry, error) {
		return local, nil
	})
	if !resolution.Masked || resolution.Found {
		t.Fatalf("resolution = %#v", resolution)
	}

	source.tree.Files = nil
	now = now.Add(2 * time.Second)
	entries = store.Entries(context.Background(), []programming.Entry{local})
	if len(entries) != 1 || entries[0].Title != "Local" {
		t.Fatalf("restored entries = %#v", entries)
	}
	sitemap, err := BuildSitemap(FallbackSitemap(), entries, "https://justindfuller.com")
	if err != nil || !strings.Contains(string(sitemap), "/programming/local-post") {
		t.Fatalf("restored sitemap = %s, err = %v", sitemap, err)
	}
}

func TestUnsupportedImageIsolatedFromPost(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("post", "post.md", "post.md"),
			file("image", "diagram.gif", "image/diagram.gif"),
		}},
		content: map[string][]byte{
			"post": markdown("external-post", "local", "add", "Before\n\n![Diagram](image/diagram.gif)\n\nAfter"),
		},
		downloadErr: map[string]error{},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "Before") || !strings.Contains(string(entries[0].Content), "After") {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	categories := make(map[string]bool, len(diagnostics.Issues))
	for _, issue := range diagnostics.Issues {
		categories[issue.Category] = true
	}
	if !categories["source_layout"] || !categories["image_validation"] {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestMetadataRejectsUnknownKeysAndMalformedTags(t *testing.T) {
	for _, frontMatter := range []string{
		"environment: local\nsection: programming\nslug: post\ntitle: Post\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: [test]\nextra: true",
		"environment: local\nsection: programming\nslug: post\ntitle: Post\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: test",
	} {
		if _, err := parseMetadata(frontMatter); err == nil {
			t.Fatalf("front matter unexpectedly valid: %s", frontMatter)
		}
	}
}

func TestInvalidLayoutRevisionRetainsLastKnownGoodPost(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}

	source.tree.Files[0].Path = "notes/post.md"
	source.tree.Files[0].Revision = "2"
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "post" {
		t.Fatalf("fallback entries = %#v diagnostics = %#v", entries, store.Diagnostics(context.Background(), nil))
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	if len(diagnostics.Issues) != 1 || diagnostics.Issues[0].Fallback != "last_known_good_external" {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestUnpublishableRevisionRetainsLastKnownGoodPost(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}
	source.content["post"] = []byte(strings.Replace(string(source.content["post"]), "sync: add", "sync: overwrite", 1))
	source.tree.Files[0].Revision = "2"
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "post" {
		t.Fatalf("fallback entries = %#v diagnostics = %#v", entries, store.Diagnostics(context.Background(), nil))
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	foundFallback := false
	for _, issue := range diagnostics.Issues {
		if issue.Fallback == "last_known_good_external" {
			foundFallback = true
		}
	}
	if !foundFallback {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestRouteCollisionRetainsPreviousOwner(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("owner", "owner.md", "owner.md")}},
		content:     map[string][]byte{"owner": markdown("post", "local", "add", "owner body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}
	source.tree.Files = append(source.tree.Files, file("new", "new.md", "new.md"))
	source.content["new"] = markdown("post", "local", "add", "new body")
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || string(entries[0].Content) == "" {
		t.Fatalf("entries = %#v", entries)
	}
	diagnostics := store.Diagnostics(context.Background(), nil)
	foundCollision := false
	for _, issue := range diagnostics.Issues {
		if issue.FileID == "new" && issue.Category == "route_collision" {
			foundCollision = true
		}
	}
	if !foundCollision {
		t.Fatalf("issues = %#v", diagnostics.Issues)
	}
}

func TestSynchronizationEventsAreDeduplicatedAndDeletionIsObservable(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	events := make([]Event, 0)
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	config.EventLogger = func(event Event) { events = append(events, event) }
	store := NewStore(config)
	store.Entries(context.Background(), nil)
	firstCount := len(events)
	store.Entries(context.Background(), nil)
	if len(events) != firstCount {
		t.Fatalf("events were not deduplicated: %d then %d", firstCount, len(events))
	}

	source.tree.Files = nil
	now = now.Add(2 * time.Second)
	store.Entries(context.Background(), nil)
	foundDeletion := false
	for _, event := range events {
		if event.Name == "sync_entry_deleted" {
			foundDeletion = true
		}
	}
	if !foundDeletion {
		t.Fatalf("events = %#v", events)
	}
}

func TestAdditiveDeletionRemovesRouteAndPreservesLocalSitemapEntries(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": markdown("external-post", "local", "add", "body")},
		downloadErr: map[string]error{},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("initial entries = %#v", entries)
	}
	source.tree.Files = nil
	now = now.Add(2 * time.Second)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 0 {
		t.Fatalf("deleted entries = %#v", entries)
	}
	base := FallbackSitemap()
	sitemap, err := BuildSitemap(base, entries, "https://justindfuller.com")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(sitemap), "/programming/external-post") || !strings.Contains(string(sitemap), "https://justindfuller.com/") {
		t.Fatalf("sitemap = %s", sitemap)
	}
}

func TestCorrectedFileEmitsRecoveryEventWithoutDuplicateNotifications(t *testing.T) {
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	source := &memorySource{
		tree:        SourceTree{Files: []RemoteFile{file("post", "post.md", "post.md")}},
		content:     map[string][]byte{"post": []byte("---\ntitle: invalid\n---\nbody")},
		downloadErr: map[string]error{},
	}
	var events []Event
	var notifications []Issue
	config := fixedConfig(source, EnvironmentLocal)
	config.Now = func() time.Time { return now }
	config.EventLogger = func(event Event) { events = append(events, event) }
	config.NotificationLogger = func(issue Issue) { notifications = append(notifications, issue) }
	store := NewStore(config)
	store.Entries(context.Background(), nil)
	firstNotifications := len(notifications)
	now = now.Add(2 * time.Second)
	store.Entries(context.Background(), nil)
	if len(notifications) != firstNotifications {
		t.Fatalf("notifications = %#v", notifications)
	}
	source.content["post"] = markdown("post", "local", "add", "corrected body")
	source.tree.Files[0].Revision = "2"
	now = now.Add(2 * time.Second)
	if entries := store.Entries(context.Background(), nil); len(entries) != 1 {
		t.Fatalf("corrected entries = %#v", entries)
	}
	foundRecovery := false
	for _, event := range events {
		if event.Name == "sync_issue_recovered" {
			foundRecovery = true
		}
	}
	if !foundRecovery {
		t.Fatalf("events = %#v", events)
	}
}

func TestRenderedSafetyValidationRejectsExecutableContent(t *testing.T) {
	for _, rendered := range []string{
		`<p><script>alert(1)</script></p>`,
		`<p><a href=javascript:alert(1)>link</a></p>`,
		`<p><img src="../secret.png"></p>`,
	} {
		if !containsProhibitedRenderedContent(rendered) {
			t.Fatalf("rendered content unexpectedly passed: %s", rendered)
		}
	}
}
