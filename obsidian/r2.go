package obsidian

import (
	"context"
	"errors"
	"io"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type r2Client interface {
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	HeadObject(context.Context, *s3.HeadObjectInput, ...func(*s3.Options)) (*s3.HeadObjectOutput, error)
}

type R2Reader struct {
	client r2Client
	bucket string
}

func NewR2Reader(account, bucket, accessKey, secretKey string) (*R2Reader, error) {
	if !regexp.MustCompile(`^[a-f0-9]{32}$`).MatchString(account) || !regexp.MustCompile(`^[a-z0-9-]{3,63}$`).MatchString(bucket) || accessKey == "" || secretKey == "" {
		return nil, errors.New("invalid private R2 source configuration")
	}
	config := aws.Config{Region: "auto", Credentials: credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""), HTTPClient: &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
	client := s3.NewFromConfig(config, func(options *s3.Options) {
		options.BaseEndpoint = aws.String("https://" + account + ".r2.cloudflarestorage.com")
		options.RetryMaxAttempts = 3
		options.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
	})
	return &R2Reader{client: client, bucket: bucket}, nil
}

func (r *R2Reader) Read(ctx context.Context, key string, limit int64) ([]byte, error) {
	if limit < 0 || limit == math.MaxInt64 || key != "latest.json" && !regexp.MustCompile(`^snapshots/[a-f0-9]{64}\.json$|^markdown/v1/[a-f0-9]{64}\.md$`).MatchString(key) {
		return nil, errors.New("unsupported source body request")
	}
	response, err := r.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(r.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, errors.New("private source object read failed")
	}
	if response == nil || response.Body == nil {
		return nil, errors.New("private source object has no body")
	}
	defer func() { _ = response.Body.Close() }()
	if response.ContentLength != nil && *response.ContentLength > limit {
		return nil, errors.New("source object exceeds protocol limit")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || int64(len(body)) > limit {
		return nil, errors.New("source object read failed or exceeded limit")
	}
	return body, nil
}

func (r *R2Reader) Head(ctx context.Context, key string) (ObjectMetadata, error) {
	if !regexp.MustCompile(`^v1/[a-f0-9]{64}\.(png|jpg|svg)$`).MatchString(key) {
		return ObjectMetadata{}, errors.New("unsupported image metadata request")
	}
	response, err := r.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(r.bucket), Key: aws.String(key)})
	if err != nil || response == nil {
		return ObjectMetadata{}, errors.New("private image metadata unavailable")
	}
	return ObjectMetadata{Size: aws.ToInt64(response.ContentLength), ContentType: aws.ToString(response.ContentType), SHA256: response.Metadata["sha256"], MD5: response.Metadata["md5"]}, nil
}

func VerifyStateImages(ctx context.Context, reader ObjectReader, source *LoadedSource, previous State) {
	for _, images := range previous.FileImages {
		for name, record := range images {
			if _, checked := source.Ready[record.Key]; checked || !validImageRecord(name, record) || !strings.HasPrefix(record.Key, "v1/") {
				continue
			}
			metadata, err := reader.Head(ctx, record.Key)
			source.Ready[record.Key] = err == nil && metadata.Size == record.Size && metadata.ContentType == record.ContentType && metadata.SHA256 == record.SHA256 && metadata.MD5 == record.MD5
		}
	}
}
