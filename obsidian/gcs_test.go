package obsidian

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/api/option"
	"google.golang.org/api/storage/v1"
)

type gcsRoundTripper func(*http.Request) (*http.Response, error)

func (f gcsRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func newTestGCSSource(t *testing.T, handler http.Handler, prefix string) *gcsSource {
	t.Helper()
	client := &http.Client{Transport: gcsRoundTripper(func(request *http.Request) (*http.Response, error) {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		response := recorder.Result()
		response.Request = request
		return response, nil
	})}
	service, err := storage.NewService(
		context.Background(),
		option.WithEndpoint("https://storage.test/storage/v1/"),
		option.WithHTTPClient(client),
		option.WithoutAuthentication(),
	)
	if err != nil {
		t.Fatalf("create storage service: %v", err)
	}
	return newGCSSourceWithService(service, "test-bucket", prefix)
}

func TestGCSReadListsPaginatedObjectsWithRelativePathsAndMetadata(t *testing.T) {
	var pageRequests int
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/storage/v1/b/test-bucket/o" {
			http.NotFound(w, r)
			return
		}
		if got := r.URL.Query().Get("prefix"); got != "Documents/Blog/" {
			t.Errorf("prefix = %q", got)
		}
		pageRequests++
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("pageToken") == "next" {
			_, _ = w.Write([]byte(`{"items":[{"name":"Documents/Blog/asset-manifest.json","generation":"30","size":"48","md5Hash":"m8rM8F4is2vD7+R+5lL0gg==","contentType":"application/json"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"nextPageToken":"next","items":[{"name":"Documents/Blog/post.md","generation":"10","size":"3","md5Hash":"kAFQmDzST7DWlj99KOF/cg==","contentType":"text/markdown"},{"name":"Documents/Blog/image/","generation":"11","size":"0","md5Hash":"","contentType":"application/x-www-form-urlencoded"},{"name":"Documents/Blog/image/diagram.png","generation":"20","size":"5","md5Hash":"A1B2C3==","contentType":"image/png"}]}`))
	})
	source := newTestGCSSource(t, handler, "Documents/Blog")

	tree, err := source.Read(context.Background(), "Documents/Blog")
	if err != nil {
		t.Fatalf("read GCS objects: %v", err)
	}
	if pageRequests != 2 {
		t.Fatalf("page requests = %d, want 2", pageRequests)
	}
	if len(tree.Files) != 4 {
		t.Fatalf("file count = %d, want 4: %#v", len(tree.Files), tree.Files)
	}
	if tree.Files[0].Path != "asset-manifest.json" || tree.Files[1].Path != "image" || !tree.Files[1].IsFolder || tree.Files[2].Path != "image/diagram.png" || tree.Files[3].Path != "post.md" {
		t.Fatalf("paths or folder state are incorrect: %#v", tree.Files)
	}
	post := tree.Files[3]
	if post.Revision != "10" || post.Size != 3 || post.MD5 != "kAFQmDzST7DWlj99KOF/cg==" {
		t.Fatalf("post metadata = %#v", post)
	}
	reference, err := decodeGCSObjectID(post.ID)
	if err != nil || reference.Name != "Documents/Blog/post.md" || reference.Generation != 10 {
		t.Fatalf("decoded object reference = %#v, error = %v", reference, err)
	}
}

func TestGCSDownloadUsesListedGenerationAndEnforcesSizeLimit(t *testing.T) {
	var gotGeneration string
	var gotObjectPath string
	tooLarge := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("alt") != "media" {
			http.NotFound(w, r)
			return
		}
		gotGeneration = r.URL.Query().Get("generation")
		gotObjectPath = r.URL.Path
		if tooLarge {
			_, _ = w.Write([]byte(strings.Repeat("x", maxSourceDownloadBytes+1)))
			return
		}
		_, _ = w.Write([]byte("body"))
	})
	source := newTestGCSSource(t, handler, "Documents/Blog")
	id := encodeGCSObjectID("Documents/Blog/post.md", 42)
	data, err := source.Download(context.Background(), id)
	if err != nil || string(data) != "body" {
		t.Fatalf("download data = %q, error = %v", data, err)
	}
	if gotGeneration != "42" || !strings.Contains(gotObjectPath, "post.md") {
		t.Fatalf("download request path=%q generation=%q", gotObjectPath, gotGeneration)
	}
	tooLarge = true
	if _, err := source.Download(context.Background(), id); err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("oversized download error = %v", err)
	}
}

func TestGCSDownloadRejectsMalformedAndOutOfPrefixIDs(t *testing.T) {
	source := newTestGCSSource(t, http.NotFoundHandler(), "Documents/Blog")
	if _, err := source.Download(context.Background(), "bad"); err == nil {
		t.Fatal("malformed object ID was accepted")
	}
	outsidePrefix := encodeGCSObjectID("Documents/Other/post.md", 1)
	if _, err := source.Download(context.Background(), outsidePrefix); err == nil {
		t.Fatal("object outside the configured prefix was accepted")
	}
}

func TestGCSObjectIDIsBase64URLSafe(t *testing.T) {
	name := "Documents/Blog/image/a b+%.png"
	id := encodeGCSObjectID(name, 123)
	if strings.ContainsAny(id, "+/=") {
		t.Fatalf("object ID is not URL safe: %q", id)
	}
	reference, err := decodeGCSObjectID(id)
	if err != nil || reference.Name != name || reference.Generation != 123 {
		t.Fatalf("decoded reference = %#v, error = %v", reference, err)
	}
	if _, err := base64.RawURLEncoding.DecodeString(id); err != nil {
		t.Fatal(err)
	}
}
