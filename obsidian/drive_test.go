package obsidian

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

func TestDriveReadIncludesImageChecksumAndSizeWithoutDownloadingIt(t *testing.T) {
	var downloadCount int
	transport := gcsRoundTripper(func(request *http.Request) (*http.Response, error) {
		recorder := httptest.NewRecorder()
		recorder.Header().Set("Content-Type", "application/json")
		switch {
		case request.URL.Path == "/drive/v3/files" && request.URL.Query().Get("q") == "'folder' in parents and trashed = false":
			if !strings.Contains(request.URL.Query().Get("fields"), "md5Checksum,size") {
				t.Errorf("Drive list did not request checksum and size")
			}
			_, _ = recorder.WriteString(`{"files":[{"id":"image-folder","name":"image","mimeType":"application/vnd.google-apps.folder","version":"1"}]}`)
		case request.URL.Path == "/drive/v3/files" && request.URL.Query().Get("q") == "'image-folder' in parents and trashed = false":
			_, _ = recorder.WriteString(`{"files":[{"id":"image-id","name":"diagram.png","mimeType":"image/png","version":"3","size":"42","md5Checksum":"00112233445566778899aabbccddeeff"}]}`)
		case request.URL.Path == "/drive/v3/files/image-id":
			downloadCount++
			_, _ = recorder.WriteString("image bytes")
		default:
			http.NotFound(recorder, request)
		}
		response := recorder.Result()
		response.Request = request
		return response, nil
	})
	service, err := drive.NewService(context.Background(),
		option.WithEndpoint("https://drive.test/drive/v3/"),
		option.WithHTTPClient(&http.Client{Transport: transport}),
		option.WithoutAuthentication(),
	)
	if err != nil {
		t.Fatal(err)
	}
	source := &driveSource{service: service}
	tree, err := source.Read(context.Background(), "folder")
	if err != nil {
		t.Fatal(err)
	}
	if len(tree.Files) != 2 || tree.Files[1].Path != "image/diagram.png" || tree.Files[1].Size != 42 {
		t.Fatalf("unexpected Drive listing: %#v", tree.Files)
	}
	digest, _ := hex.DecodeString("00112233445566778899aabbccddeeff")
	if tree.Files[1].MD5 != base64.StdEncoding.EncodeToString(digest) {
		t.Fatalf("unexpected Drive image checksum: %q", tree.Files[1].MD5)
	}
	if downloadCount != 0 {
		t.Fatalf("listing downloaded %d image objects", downloadCount)
	}
}
