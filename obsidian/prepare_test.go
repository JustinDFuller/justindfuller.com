package obsidian

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

func post(environment, slug, mode, body string, draft bool) []byte {
	return fmt.Appendf(nil, "---\nenvironment: %s\nsection: programming\nslug: %s\ntitle: Example\ndate: 2026-09-20\ndraft: %t\nsync: %s\ntags: [programming]\n---\n%s", environment, slug, draft, mode, body)
}

func loaded(files map[string][]byte, images map[string]ImageRecord) LoadedSource {
	snapshot := SourceSnapshot{Version: 1, Files: map[string]FileRecord{}, Images: images}
	if images == nil {
		snapshot.Images = map[string]ImageRecord{}
	}
	for name, raw := range files {
		hash := SHA256(raw)
		snapshot.Files[name] = FileRecord{Key: "markdown/v1/" + hash + ".md", SHA256: hash, Size: int64(len(raw))}
	}
	canonical, _ := CanonicalSnapshot(snapshot)
	ready := map[string]bool{}
	for _, image := range snapshot.Images {
		ready[image.Key] = true
	}
	return LoadedSource{Snapshot: snapshot, Revision: SHA256(canonical), Bodies: files, Ready: ready}
}

func prepare(t *testing.T, source LoadedSource, previous State, local []programming.Entry, mode Mode) Prepared {
	t.Helper()
	result, err := Prepare(source, previous, local, mode, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestTargetsAndDrafts(t *testing.T) {
	for _, mode := range []Mode{ModeProduction, ModeStaging, ModePreview, ModeLocal} {
		t.Run(string(mode), func(t *testing.T) {
			source := loaded(map[string][]byte{"p.md": post("production", "public", "add", "Public body", false), "n.md": post("nonprod", "secret", "add", "Private body", false), "d.md": post("production", "draft", "add", "Draft body", true)}, nil)
			result := prepare(t, source, State{}, nil, mode)
			want := 2
			if mode == ModeProduction {
				want = 1
			}
			if len(result.Entries) != want {
				t.Fatalf("entries=%d want %d", len(result.Entries), want)
			}
			for _, entry := range result.Entries {
				if entry.Slug == "draft" || (mode == ModeProduction && entry.Slug == "secret") {
					t.Fatal("excluded post rendered")
				}
			}
		})
	}
	for _, legacy := range []string{"prd", "pr", "local", "unknown"} {
		result := prepare(t, loaded(map[string][]byte{"p.md": post(legacy, "post", "add", "Body", false)}, nil), State{}, nil, ModeLocal)
		if len(result.Entries) != 0 || len(result.Issues) == 0 {
			t.Fatalf("accepted alias %q", legacy)
		}
	}
}

func TestFallbackDemotionDeletionAndDraftMask(t *testing.T) {
	git := []programming.Entry{{Slug: "existing", Title: "Git", Content: "Git body"}}
	initial := loaded(map[string][]byte{"p.md": post("production", "existing", "overwrite", "Original body", false), "a.md": post("production", "added", "add", "Added body", false)}, nil)
	accepted := prepare(t, initial, State{}, git, ModeProduction)
	serialized, err := json.Marshal(accepted.State)
	if err != nil {
		t.Fatal(err)
	}
	var fresh State
	if err := DecodeStrict(serialized, &fresh); err != nil {
		t.Fatal(err)
	}
	invalid := loaded(map[string][]byte{"p.md": post("production", "existing", "overwrite", "<script>alert(1)</script>", false), "a.md": post("production", "added", "add", "New valid body", false)}, nil)
	result := prepare(t, invalid, fresh, git, ModeProduction)
	for _, entry := range result.Entries {
		if entry.Slug == "existing" && !strings.Contains(string(entry.Content), "Original body") {
			t.Fatal("fresh-runner fallback lost")
		}
		if entry.Slug == "added" && !strings.Contains(string(entry.Content), "New valid body") {
			t.Fatal("unrelated valid update blocked")
		}
	}
	demoted := loaded(map[string][]byte{"p.md": post("nonprod", "existing", "overwrite", "<script>invalid body</script>", false)}, nil)
	result = prepare(t, demoted, fresh, git, ModeProduction)
	if len(result.Entries) != 1 || result.Entries[0].Title != "Git" || len(result.State.Files) != 0 {
		t.Fatal("demotion retained external ownership")
	}
	result = prepare(t, loaded(map[string][]byte{}, nil), fresh, git, ModeProduction)
	if len(result.Entries) != 1 || result.Entries[0].Title != "Git" {
		t.Fatal("deletion did not restore Git")
	}
	result = prepare(t, loaded(map[string][]byte{"p.md": post("production", "existing", "overwrite", "Draft body", true)}, nil), fresh, git, ModeProduction)
	if len(result.Entries) != 0 || len(result.Masks) != 1 || result.Masks[0] != "existing" {
		t.Fatal("draft overwrite exposed Git fallback")
	}
	if _, err := Prepare(initial, fresh, git, ModeStaging, time.Unix(0, 0)); err == nil {
		t.Fatal("cross-target accepted state reused")
	}
}

func TestCollisionRetainsAcceptedOwnerAndRenameFallback(t *testing.T) {
	initial := loaded(map[string][]byte{"a.md": post("production", "post", "add", "Accepted", false)}, nil)
	accepted := prepare(t, initial, State{}, nil, ModeProduction)
	conflict := loaded(map[string][]byte{"a.md": post("production", "post", "add", "Unaccepted edit", false), "b.md": post("production", "post", "add", "Conflicting", false)}, nil)
	result := prepare(t, conflict, accepted.State, nil, ModeProduction)
	if len(result.Entries) != 1 || !strings.Contains(string(result.Entries[0].Content), "Accepted") || len(result.Issues) == 0 {
		t.Fatal("collision did not preserve accepted owner")
	}
	git := []programming.Entry{{Slug: "taken", Content: "Git"}}
	result = prepare(t, loaded(map[string][]byte{"a.md": post("production", "taken", "add", "Rejected route", false)}, nil), accepted.State, git, ModeProduction)
	if len(result.Entries) != 2 {
		t.Fatal("rejected rename removed old route")
	}
	result = prepare(t, loaded(map[string][]byte{"a.md": post("production", "renamed", "add", "Accepted rename", false)}, nil), accepted.State, nil, ModeProduction)
	if len(result.Entries) != 1 || result.Entries[0].Slug != "renamed" {
		t.Fatal("accepted rename retained old route")
	}
}

func TestImageIsolationCodeMaskingAndPrivateURLs(t *testing.T) {
	hash := strings.Repeat("a", 64)
	record := ImageRecord{SHA256: hash, MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + hash + ".png"}
	images := map[string]ImageRecord{"image/space (one).png": record, "image/space(one).png": record}
	bodies := []string{`![alt](image/space\(one\).png)`, `![alt](<image/space (one).png> "title")`, `![[space (one).png]]`}
	for _, body := range bodies {
		for _, mode := range []Mode{ModeProduction, ModeStaging} {
			result := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", body, false)}, images), State{}, nil, mode)
			if len(result.Entries) != 1 || len(result.Images) != 1 {
				t.Fatalf("image syntax omitted: %s issues=%v", body, result.Issues)
			}
			prefix := "/__obsidian/media/v1/"
			if mode == ModeProduction {
				prefix = "https://media.justindfuller.com/v1/"
			}
			if !strings.Contains(string(result.Entries[0].Content), prefix) {
				t.Fatal("incorrect image boundary")
			}
		}
	}
	for _, body := range []string{"```md\n![[missing.png]]\n```\nBody", "~~~md\n![example](image/missing.png)\n~~~\nBody", "`![[missing.png]]`\nBody", "`` `![[missing.png]]` ``\nBody"} {
		result := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", body, false)}, nil), State{}, nil, ModeProduction)
		if len(result.Entries) != 1 || len(result.Issues) != 0 {
			t.Fatalf("code example rejected: %q %v", body, result.Issues)
		}
	}
	private := loaded(map[string][]byte{"n.md": post("nonprod", "secret", "add", bodies[0], false), "d.md": post("production", "draft", "add", bodies[0], true)}, images)
	if result := prepare(t, private, State{}, nil, ModeProduction); len(result.Images) != 0 {
		t.Fatal("nonprod/draft image eligible for public promotion")
	}
	missing := loaded(map[string][]byte{"p.md": post("production", "post", "add", "Text ![missing](image/missing.png)", false)}, nil)
	if result := prepare(t, missing, State{}, nil, ModeProduction); len(result.Entries) != 1 || len(result.Images) != 0 || len(result.Issues) != 1 {
		t.Fatal("missing image rejected whole post")
	}
}

func TestSafetyAndMalformedMarkdown(t *testing.T) {
	for _, body := range []string{"<script>x</script>", "<iframe src='x'></iframe>", "<p onclick='x'>Text</p>", "<a href='javascript:x'>Text</a>", "<a href='../secret'>Text</a>", "[[unsupported]]", "![bad](<unclosed)", ""} {
		result := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", body, false)}, nil), State{}, nil, ModeProduction)
		if len(result.Entries) != 0 {
			t.Fatalf("accepted unsafe or malformed body: %q", body)
		}
	}
	result := prepare(t, loaded(map[string][]byte{"p.md": append(post("production", "post", "add", "Body", false), 0xff)}, nil), State{}, nil, ModeProduction)
	if len(result.Entries) != 0 {
		t.Fatal("invalid UTF-8 accepted")
	}
}

type memoryObjects struct {
	objects  map[string][]byte
	metadata map[string]ObjectMetadata
	reads    []string
	heads    []string
}

func (m *memoryObjects) Read(_ context.Context, key string, limit int64) ([]byte, error) {
	m.reads = append(m.reads, key)
	value, found := m.objects[key]
	if !found {
		return nil, errors.New("unavailable")
	}
	if int64(len(value)) > limit {
		return nil, errors.New("limit exceeded")
	}
	return value, nil
}

func (m *memoryObjects) Head(_ context.Context, key string) (ObjectMetadata, error) {
	m.heads = append(m.heads, key)
	value, found := m.metadata[key]
	if !found {
		return ObjectMetadata{}, errors.New("unavailable")
	}
	return value, nil
}

func TestSnapshotPinnedIntegrityAndMetadataOnlyImages(t *testing.T) {
	hash := strings.Repeat("a", 64)
	image := ImageRecord{SHA256: hash, MD5: strings.Repeat("b", 32), Size: 20, ContentType: "image/png", Key: "v1/" + hash + ".png"}
	source := loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, map[string]ImageRecord{"image/a.png": image})
	manifest, _ := CanonicalSnapshot(source.Snapshot)
	pointer, _ := json.Marshal(map[string]any{"version": 1, "revision": source.Revision})
	objects := memoryObjects{objects: map[string][]byte{"latest.json": pointer, "snapshots/" + source.Revision + ".json": manifest}, metadata: map[string]ObjectMetadata{image.Key: {Size: image.Size, ContentType: image.ContentType, SHA256: image.SHA256, MD5: image.MD5}}}
	for name, raw := range source.Bodies {
		objects.objects[source.Snapshot.Files[name].Key] = raw
	}
	result, err := ReadSource(context.Background(), &objects)
	if err != nil || !result.Ready[image.Key] {
		t.Fatalf("source read failed: %v", err)
	}
	if len(objects.reads) != 3 || len(objects.heads) != 1 {
		t.Fatalf("unexpected source IO: %v %v", objects.reads, objects.heads)
	}
	for _, key := range objects.reads {
		if strings.HasPrefix(key, "v1/") {
			t.Fatal("image body read by Go")
		}
	}
	objects.objects[source.Snapshot.Files["p.md"].Key] = []byte("corrupt")
	if _, err := ReadSource(context.Background(), &objects); err == nil {
		t.Fatal("corrupt Markdown accepted")
	}
	delete(objects.objects, "latest.json")
	if _, err := ReadSource(context.Background(), &objects); err == nil {
		t.Fatal("source outage mistaken for empty snapshot")
	}
	for _, body := range []string{`{"version":1,"version":1,"files":{},"images":{}}`, `{"version":1,"files":{"x":{},"x":{}},"images":{}}`, `{"version":1,"files":{},"images":{},"unknown":true}`} {
		var snapshot SourceSnapshot
		if DecodeStrict([]byte(body), &snapshot) == nil {
			t.Fatal("ambiguous control document accepted")
		}
	}
}

func imagePost(environment, slug string, draft bool, image, body string) []byte {
	return fmt.Appendf(nil, "---\nenvironment: %s\nsection: programming\nslug: %s\ntitle: Example\ndate: 2026-09-20\ndraft: %t\nsync: add\ntags: [programming]\nimage: %s\n---\n%s", environment, slug, draft, image, body)
}

func testImage(seed, extension string) ImageRecord {
	hash := strings.Repeat(seed, 64)
	return ImageRecord{SHA256: hash, MD5: strings.Repeat("b", 32), Size: 17, ContentType: imageContentType("x" + extension), Key: "v1/" + hash + extension}
}

func mediaPrefix(mode Mode) string {
	if mode == ModeProduction {
		return "https://media.justindfuller.com/"
	}
	return "/__obsidian/media/"
}

func TestMetadataImageResolvesLikeBodyImage(t *testing.T) {
	record := testImage("a", ".png")
	images := map[string]ImageRecord{"image/cover.png": record, "image/nested/deep.png": testImage("c", ".png")}
	for _, reference := range []string{"image/cover.png", "cover.png", "./image/cover.png"} {
		for _, mode := range []Mode{ModeProduction, ModeStaging, ModePreview, ModeLocal} {
			t.Run(string(mode)+"/"+reference, func(t *testing.T) {
				result := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, reference, "Body only")}, images), State{}, nil, mode)
				if len(result.Entries) != 1 || len(result.Issues) != 0 {
					t.Fatalf("entries=%d issues=%v", len(result.Entries), result.Issues)
				}
				if want := mediaPrefix(mode) + record.Key; result.Entries[0].Image != want {
					t.Fatalf("Image=%q want %q", result.Entries[0].Image, want)
				}
				if strings.Contains(string(result.Entries[0].Content), "<img") {
					t.Fatal("metadata image leaked into the body")
				}
			})
		}
	}
	nested := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/nested/deep.png", "Body")}, images), State{}, nil, ModeProduction)
	if len(nested.Entries) != 1 || nested.Entries[0].Image != mediaPrefix(ModeProduction)+images["image/nested/deep.png"].Key {
		t.Fatalf("nested path not resolved: %v", nested.Issues)
	}
}

func TestMetadataImageSharedWithBodyUsesOneRecord(t *testing.T) {
	record := testImage("a", ".png")
	images := map[string]ImageRecord{"image/cover.png": record}
	result := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/cover.png", "![Cover alt](image/cover.png)")}, images), State{}, nil, ModeProduction)
	if len(result.Entries) != 1 || len(result.Images) != 1 || result.Entries[0].Image != mediaPrefix(ModeProduction)+record.Key {
		t.Fatalf("entries=%d images=%d issues=%v", len(result.Entries), len(result.Images), result.Issues)
	}
	if !strings.Contains(string(result.Entries[0].Content), `src="`+result.Entries[0].Image+`"`) {
		t.Fatal("body image and metadata image resolved to different URLs")
	}
}

func TestMetadataImageWithoutValueLeavesImageEmpty(t *testing.T) {
	for _, value := range []string{`""`, `"   "`} {
		result := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, value, "Body")}, nil), State{}, nil, ModeProduction)
		if len(result.Entries) != 1 || result.Entries[0].Image != "" || len(result.Issues) != 0 {
			t.Fatalf("blank %s: entries=%d issues=%v", value, len(result.Entries), result.Issues)
		}
	}
	result := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, nil), State{}, nil, ModeProduction)
	if len(result.Entries) != 1 || result.Entries[0].Image != "" {
		t.Fatal("a post without image gained one")
	}
}

func TestMetadataImageMustBeTextAndFailsOnlyThatFile(t *testing.T) {
	record := testImage("a", ".png")
	images := map[string]ImageRecord{"image/cover.png": record}
	for _, value := range []string{"[image/cover.png]", "5", "true", "{path: image/cover.png}", "null"} {
		t.Run(value, func(t *testing.T) {
			source := loaded(map[string][]byte{"bad.md": imagePost("production", "bad", false, value, "Bad body"), "good.md": imagePost("production", "good", false, "image/cover.png", "Good body")}, images)
			result := prepare(t, source, State{}, nil, ModeProduction)
			if len(result.Entries) != 1 || result.Entries[0].Slug != "good" {
				t.Fatalf("entries=%v", result.Entries)
			}
			if len(result.Issues) != 1 || result.Issues[0].Category != "markdown_metadata" || result.Issues[0].Path != "bad.md" {
				t.Fatalf("issues=%v", result.Issues)
			}
		})
	}
}

func TestOtherUnknownMetadataKeysAreStillRejected(t *testing.T) {
	for _, key := range []string{"cover", "images", "og_image", "Image"} {
		raw := fmt.Appendf(nil, "---\nenvironment: production\nsection: programming\nslug: post\ntitle: Example\ndate: 2026-09-20\ndraft: false\nsync: add\ntags: [programming]\n%s: image/cover.png\n---\nBody", key)
		result := prepare(t, loaded(map[string][]byte{"p.md": raw}, map[string]ImageRecord{"image/cover.png": testImage("a", ".png")}), State{}, nil, ModeProduction)
		if len(result.Entries) != 0 || len(result.Issues) != 1 || result.Issues[0].Category != "markdown_metadata" {
			t.Fatalf("key %q: entries=%d issues=%v", key, len(result.Entries), result.Issues)
		}
	}
}

func TestMetadataImageProblemsDropOnlyTheImage(t *testing.T) {
	record := testImage("a", ".png")
	tests := []struct {
		name      string
		reference string
		images    map[string]ImageRecord
		notReady  bool
		category  string
	}{
		{name: "missing", reference: "image/nope.png", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_not_found"},
		{name: "missing bare name", reference: "nope.png", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_not_found"},
		{name: "ambiguous", reference: "cover.png", images: map[string]ImageRecord{"image/one/cover.png": record, "image/two/cover.png": record}, category: "image_ambiguous"},
		{name: "unsupported type", reference: "image/cover.gif", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_validation"},
		{name: "absolute url", reference: "https://example.com/cover.png", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_reference_outside_source"},
		{name: "absolute path", reference: "/image/cover.png", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_reference_outside_source"},
		{name: "traversal", reference: "../cover.png", images: map[string]ImageRecord{"image/cover.png": record}, category: "image_reference_outside_source"},
		{name: "not ready", reference: "image/cover.png", images: map[string]ImageRecord{"image/cover.png": record}, notReady: true, category: "image_not_ready"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := loaded(map[string][]byte{"p.md": imagePost("production", "post", false, test.reference, "Body text")}, test.images)
			if test.notReady {
				source.Ready[record.Key] = false
			}
			result := prepare(t, source, State{}, nil, ModeProduction)
			if len(result.Entries) != 1 || result.Entries[0].Slug != "post" {
				t.Fatalf("post was not published: %v", result.Issues)
			}
			if result.Entries[0].Image != "" {
				t.Fatalf("Image=%q want empty", result.Entries[0].Image)
			}
			if !strings.Contains(string(result.Entries[0].Content), "Body text") {
				t.Fatal("post body lost")
			}
			if len(result.Issues) != 1 {
				t.Fatalf("issues=%v", result.Issues)
			}
			issue := result.Issues[0]
			if issue.Category != test.category || issue.Route != "post" || issue.Reference != test.reference || issue.Path != "p.md" {
				t.Fatalf("issue=%+v", issue)
			}
			if len(result.Images) != 0 {
				t.Fatal("an unusable image was recorded as used")
			}
		})
	}
}

func TestBadMetadataImageKeepsBodyImages(t *testing.T) {
	record := testImage("a", ".png")
	images := map[string]ImageRecord{"image/body.png": record}
	result := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/nope.png", "![Body alt](image/body.png)")}, images), State{}, nil, ModeProduction)
	if len(result.Entries) != 1 || result.Entries[0].Image != "" || len(result.Images) != 1 || len(result.Issues) != 1 {
		t.Fatalf("entries=%v images=%d issues=%v", result.Entries, len(result.Images), result.Issues)
	}
	if !strings.Contains(string(result.Entries[0].Content), mediaPrefix(ModeProduction)+record.Key) {
		t.Fatal("body image dropped with the bad metadata image")
	}
}

func TestMetadataImageSurvivesAcceptedFallback(t *testing.T) {
	record := testImage("a", ".png")
	images := map[string]ImageRecord{"image/cover.png": record}
	accepted := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/cover.png", "Body")}, images), State{}, nil, ModeProduction)
	if len(accepted.Entries) != 1 || accepted.Entries[0].Image != mediaPrefix(ModeProduction)+record.Key {
		t.Fatalf("setup failed: %v", accepted.Issues)
	}
	fallback, err := PrepareAccepted(accepted.State, nil, ModeProduction, nil, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if len(fallback.Entries) != 1 || fallback.Entries[0].Image != accepted.Entries[0].Image || fallback.Digest != accepted.Digest {
		t.Fatalf("fallback Image=%q digest match=%t", fallback.Entries[0].Image, fallback.Digest == accepted.Digest)
	}
	if len(fallback.Images) != 1 {
		t.Fatal("fallback lost the metadata image record")
	}
	unavailable, err := PrepareAccepted(accepted.State, nil, ModeProduction, map[string]bool{record.Key: true}, time.Unix(0, 0))
	if err != nil || len(unavailable.Entries) != 1 || unavailable.Entries[0].Image != "" || len(unavailable.Images) != 0 {
		t.Fatalf("an unavailable metadata image stayed in the entry: %v", err)
	}
}

func TestEntryWithoutImageKeepsPriorDigest(t *testing.T) {
	result := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, nil), State{}, nil, ModeProduction)
	encoded, err := json.Marshal(result.Entries[0])
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), `"Image"`) {
		t.Fatalf("an entry without an image serialized the field: %s", encoded)
	}
}

func TestDocumentedImageExampleValidates(t *testing.T) {
	documentation, err := os.ReadFile("../docs/obsidian-cloudflare.md")
	if err != nil {
		t.Fatal(err)
	}
	_, after, found := strings.Cut(string(documentation), "### Social preview image\n")
	if !found {
		t.Fatal("documentation section missing")
	}
	_, block, found := strings.Cut(after, "```markdown\n")
	if !found {
		t.Fatal("documented example missing")
	}
	example, _, found := strings.Cut(block, "```")
	if !found {
		t.Fatal("documented example unterminated")
	}
	record := testImage("a", ".png")
	result := prepare(t, loaded(map[string][]byte{"p.md": []byte(example)}, map[string]ImageRecord{"image/1-high-level-workflow.png": record}), State{}, nil, ModeProduction)
	if len(result.Issues) != 0 || len(result.Entries) != 1 || result.Entries[0].Image != mediaPrefix(ModeProduction)+record.Key {
		t.Fatalf("documented example did not validate: entries=%d issues=%v", len(result.Entries), result.Issues)
	}
}
