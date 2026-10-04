package obsidian

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
