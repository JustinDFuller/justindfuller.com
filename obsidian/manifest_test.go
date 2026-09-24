package obsidian

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

type countedSource struct {
	*memorySource
	downloads map[string]int
}

func (s *countedSource) Download(ctx context.Context, id string) ([]byte, error) {
	s.downloads[id]++
	return s.memorySource.Download(ctx, id)
}

func manifestFixture(t *testing.T, imagePath string, imageBytes []byte) []byte {
	t.Helper()
	digest := md5.Sum(imageBytes)
	manifest := imageManifest{Version: 1, Images: map[string]imageRecord{
		imagePath: {
			SHA256:      strings.Repeat("a", 64),
			MD5:         hex.EncodeToString(digest[:]),
			Size:        int64(len(imageBytes)),
			ContentType: imageContentType(imagePath),
			Key:         "v1/" + strings.Repeat("a", 64) + ".png",
		},
	}}
	raw, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestManifestPublishesURLWithoutDownloadingImageAndCachesUnchangedFiles(t *testing.T) {
	imageBytes := validPNG()
	digest := md5.Sum(imageBytes)
	image := file("image", "diagram.png", "image/diagram.png")
	image.MD5 = base64.StdEncoding.EncodeToString(digest[:])
	image.Size = int64(len(imageBytes))
	source := &countedSource{
		memorySource: &memorySource{
			tree: SourceTree{Files: []RemoteFile{
				file("post", "post.md", "post.md"),
				image,
				file("manifest", assetManifestPath, assetManifestPath),
			}},
			content: map[string][]byte{
				"post":     markdown("external-post", "local", "add", "![[diagram.png]]"),
				"manifest": manifestFixture(t, image.Path, imageBytes),
			},
			downloadErr: map[string]error{"image": errors.New("image download is forbidden")},
		},
		downloads: make(map[string]int),
	}
	now := time.Date(2026, 9, 24, 0, 0, 0, 0, time.UTC)
	config := fixedConfig(source.memorySource, EnvironmentLocal)
	config.ImageResolver = nil
	config.SourceFactory = func(context.Context) (Source, error) { return source, nil }
	config.Now = func() time.Time { return now }
	store := NewStore(config)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || !strings.Contains(string(entries[0].Content), "https://media.justindfuller.com/v1/"+strings.Repeat("a", 64)+".png") {
		t.Fatalf("entry did not use CDN URL: %#v", entries)
	}
	if source.downloads["image"] != 0 || source.downloads["post"] != 1 || source.downloads["manifest"] != 1 {
		t.Fatalf("unexpected downloads: %#v", source.downloads)
	}
	now = now.Add(2 * time.Second)
	store.Entries(context.Background(), nil)
	if source.downloads["image"] != 0 || source.downloads["post"] != 1 || source.downloads["manifest"] != 1 {
		t.Fatalf("unchanged files were downloaded again: %#v", source.downloads)
	}
	source.tree.Files[2].Revision = "2"
	now = now.Add(2 * time.Second)
	store.Entries(context.Background(), nil)
	if source.downloads["post"] != 2 || source.downloads["manifest"] != 2 || source.downloads["image"] != 0 {
		t.Fatalf("manifest change did not revalidate posts: %#v", source.downloads)
	}
}

func TestInvalidManifestRecordOnlyAffectsReferencedImage(t *testing.T) {
	imageBytes := validPNG()
	digest := md5.Sum(imageBytes)
	image := file("image", "diagram.png", "image/diagram.png")
	image.MD5 = base64.StdEncoding.EncodeToString(digest[:])
	image.Size = int64(len(imageBytes))
	var manifest imageManifest
	if err := json.Unmarshal(manifestFixture(t, image.Path, imageBytes), &manifest); err != nil {
		t.Fatal(err)
	}
	record := manifest.Images[image.Path]
	record.Key = "../unsafe.png"
	manifest.Images[image.Path] = record
	raw, _ := json.Marshal(manifest)
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("bad", "bad.md", "bad.md"),
			file("good", "good.md", "good.md"),
			image,
			file("manifest", assetManifestPath, assetManifestPath),
		}},
		content: map[string][]byte{
			"bad":      markdown("bad-post", "local", "add", "![[diagram.png]]"),
			"good":     markdown("good-post", "local", "add", "No image here."),
			"manifest": raw,
		},
	}
	config := fixedConfig(source, EnvironmentLocal)
	config.ImageResolver = nil
	store := NewStore(config)
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 2 {
		t.Fatalf("invalid image metadata affected unrelated post: %#v", entries)
	}
	var found bool
	for _, issue := range store.Diagnostics(context.Background(), nil).Issues {
		if issue.FileID == "bad" && issue.Category == "image_not_ready" {
			found = true
		}
	}
	if !found {
		t.Fatal("invalid image metadata was not reported for referencing post")
	}
}

func TestOversizeMarkdownDoesNotStopOtherPosts(t *testing.T) {
	source := &memorySource{
		tree: SourceTree{Files: []RemoteFile{
			file("large", "large.md", "large.md"),
			file("good", "good.md", "good.md"),
		}},
		content:     map[string][]byte{"good": markdown("good-post", "local", "add", "Still published.")},
		downloadErr: map[string]error{"large": fmt.Errorf("%w: test", errSourceObjectTooLarge)},
	}
	store := NewStore(fixedConfig(source, EnvironmentLocal))
	entries := store.Entries(context.Background(), nil)
	if len(entries) != 1 || entries[0].Slug != "good-post" {
		t.Fatalf("oversize Markdown stopped unrelated post: %#v", entries)
	}
	issues := store.Diagnostics(context.Background(), nil).Issues
	if len(issues) != 1 || issues[0].FileID != "large" || issues[0].Category != "markdown_download" {
		t.Fatalf("unexpected issue for oversize Markdown: %#v", issues)
	}
}
