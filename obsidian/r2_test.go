package obsidian

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type fakeS3 struct {
	gets          int
	heads         int
	body          string
	closed        bool
	contentLength *int64
}

type closingBody struct {
	io.Reader
	closed *bool
}

func (b closingBody) Close() error { *b.closed = true; return nil }
func (f *fakeS3) GetObject(_ context.Context, _ *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	f.gets++
	return &s3.GetObjectOutput{Body: closingBody{Reader: strings.NewReader(f.body), closed: &f.closed}, ContentLength: f.contentLength}, nil
}
func (f *fakeS3) HeadObject(_ context.Context, _ *s3.HeadObjectInput, _ ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
	f.heads++
	return &s3.HeadObjectOutput{ContentLength: aws.Int64(4), ContentType: aws.String("image/png"), Metadata: map[string]string{"sha256": strings.Repeat("a", 64), "md5": strings.Repeat("b", 32)}}, nil
}

func TestR2ReaderNeverRequestsImageBodiesAndClosesBoundedResponses(t *testing.T) {
	client := &fakeS3{body: "four"}
	reader := &R2Reader{client: client, bucket: "private-source"}
	imageKey := "v1/" + strings.Repeat("a", 64) + ".png"
	for _, key := range []string{imageKey, "../secret", "markdown/v1/bad.md", "https://other.example"} {
		if _, err := reader.Read(t.Context(), key, 100); err == nil {
			t.Fatal("unsupported read accepted")
		}
	}
	if client.gets != 0 {
		t.Fatal("image body transport invoked")
	}
	if _, err := reader.Head(t.Context(), imageKey); err != nil || client.heads != 1 {
		t.Fatal("image HEAD failed")
	}
	if _, err := reader.Head(t.Context(), "latest.json"); err == nil || client.heads != 1 {
		t.Fatal("arbitrary metadata key allowed")
	}
	if _, err := reader.Read(t.Context(), "latest.json", 3); err == nil || !client.closed {
		t.Fatal("read limit or body close missing")
	}
	client.closed = false
	client.contentLength = aws.Int64(4)
	if _, err := reader.Read(t.Context(), "latest.json", 3); err == nil || !client.closed {
		t.Fatal("content-length guard did not close body")
	}
	if raw, err := reader.Read(t.Context(), "latest.json", 4); err != nil || string(raw) != "four" {
		t.Fatal("bounded source read failed")
	}
}

func TestHistoricalFallbackImagesReceiveMetadataChecksOnly(t *testing.T) {
	image := ImageRecord{Key: "v1/" + strings.Repeat("a", 64) + ".png", SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 4, ContentType: "image/png"}
	client := &fakeS3{}
	reader := &R2Reader{client: client, bucket: "private-source"}
	source := LoadedSource{Ready: map[string]bool{}}
	previous := State{FileImages: map[string]map[string]ImageRecord{"p.md": {"image/a.png": image}, "q.md": {"image/a.png": image}}}
	VerifyStateImages(t.Context(), reader, &source, previous)
	if !source.Ready[image.Key] || client.heads != 1 || client.gets != 0 {
		t.Fatal("historical image readiness or deduplication failed")
	}
}
