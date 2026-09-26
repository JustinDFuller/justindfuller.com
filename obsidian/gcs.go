package obsidian

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"path"
	"sort"
	"strconv"
	"strings"

	"google.golang.org/api/option"
	"google.golang.org/api/storage/v1"
)

const maxSourceDownloadBytes = 2 << 20

type gcsSource struct {
	service *storage.Service
	bucket  string
	prefix  string
}

type gcsObjectReference struct {
	Name       string `json:"name"`
	Generation int64  `json:"generation"`
}

func newGCSSource(ctx context.Context, config Config) (Source, error) {
	if strings.TrimSpace(config.GCSBucket) == "" {
		return nil, fmt.Errorf("%w: GCS bucket is required", errInvalidSourceConfiguration)
	}
	service, err := storage.NewService(ctx, option.WithScopes(storage.DevstorageReadOnlyScope))
	if err != nil {
		return nil, fmt.Errorf("%w: initialize GCS client: %w", errInvalidSourceConfiguration, err)
	}
	return &gcsSource{
		service: service,
		bucket:  config.GCSBucket,
		prefix:  normalizeGCSPrefix(config.GCSPrefix),
	}, nil
}

func newGCSSourceWithService(service *storage.Service, bucket, prefix string) *gcsSource {
	return &gcsSource{service: service, bucket: bucket, prefix: normalizeGCSPrefix(prefix)}
}

func (s *gcsSource) Read(ctx context.Context, prefix string) (SourceTree, error) {
	if s.bucket == "" || s.service == nil {
		return SourceTree{}, fmt.Errorf("%w: GCS bucket and client are required", errInvalidSourceConfiguration)
	}
	requestedPrefix := normalizeGCSPrefix(prefix)
	if requestedPrefix == "" {
		requestedPrefix = s.prefix
	}
	if s.prefix != "" && requestedPrefix != s.prefix {
		return SourceTree{}, fmt.Errorf("%w: GCS prefix does not match configured prefix", errInvalidSourceConfiguration)
	}
	listPrefix := ""
	if requestedPrefix != "" {
		listPrefix = requestedPrefix + "/"
	}

	files := make([]RemoteFile, 0)
	pageToken := ""
	for {
		call := s.service.Objects.List(s.bucket).
			Prefix(listPrefix).
			MaxResults(1000).
			Fields("nextPageToken,items(name,generation,size,md5Hash,contentType)").
			Context(ctx)
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		page, err := call.Do()
		if err != nil {
			return SourceTree{}, err
		}
		for _, object := range page.Items {
			if object == nil || !strings.HasPrefix(object.Name, listPrefix) {
				continue
			}
			objectPath := strings.TrimPrefix(object.Name, listPrefix)
			if objectPath == "" {
				continue
			}
			isFolder := strings.HasSuffix(objectPath, "/") && object.Size == 0
			if isFolder {
				objectPath = strings.TrimSuffix(objectPath, "/")
			}
			if objectPath == "" || path.IsAbs(objectPath) || path.Clean(objectPath) != objectPath || objectPath == ".." || strings.HasPrefix(objectPath, "../") {
				return SourceTree{}, fmt.Errorf("invalid GCS object path under configured prefix")
			}
			if object.Generation <= 0 {
				return SourceTree{}, fmt.Errorf("GCS object %q has no valid generation", object.Name)
			}
			if object.Size > math.MaxInt64 {
				return SourceTree{}, fmt.Errorf("GCS object %q size exceeds supported range", object.Name)
			}
			files = append(files, RemoteFile{
				ID:       encodeGCSObjectID(object.Name, object.Generation),
				Name:     path.Base(objectPath),
				Path:     objectPath,
				Revision: strconv.FormatInt(object.Generation, 10),
				MimeType: object.ContentType,
				IsFolder: isFolder,
				MD5:      object.Md5Hash,
				Size:     int64(object.Size),
			})
		}
		pageToken = page.NextPageToken
		if pageToken == "" {
			break
		}
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].Path == files[j].Path {
			return files[i].ID < files[j].ID
		}
		return files[i].Path < files[j].Path
	})
	return SourceTree{Files: files}, nil
}

func (s *gcsSource) Download(ctx context.Context, fileID string) ([]byte, error) {
	if s.bucket == "" || s.service == nil {
		return nil, fmt.Errorf("%w: GCS bucket and client are required", errInvalidSourceConfiguration)
	}
	reference, err := decodeGCSObjectID(fileID)
	if err != nil {
		return nil, err
	}
	if s.prefix != "" && !strings.HasPrefix(reference.Name, s.prefix+"/") {
		return nil, fmt.Errorf("GCS object is outside the configured prefix")
	}
	response, err := s.service.Objects.Get(s.bucket, reference.Name).
		Generation(reference.Generation).
		Context(ctx).
		Download()
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()
	data, err := io.ReadAll(io.LimitReader(response.Body, maxSourceDownloadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxSourceDownloadBytes {
		return nil, fmt.Errorf("%w: GCS object exceeds %d bytes", errSourceObjectTooLarge, maxSourceDownloadBytes)
	}
	return data, nil
}

func encodeGCSObjectID(name string, generation int64) string {
	encoded, _ := json.Marshal(gcsObjectReference{Name: name, Generation: generation})
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func decodeGCSObjectID(value string) (gcsObjectReference, error) {
	data, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return gcsObjectReference{}, fmt.Errorf("invalid GCS object ID")
	}
	var reference gcsObjectReference
	if err := json.Unmarshal(data, &reference); err != nil || reference.Name == "" || reference.Generation <= 0 {
		return gcsObjectReference{}, fmt.Errorf("invalid GCS object ID")
	}
	return reference, nil
}

func normalizeGCSPrefix(prefix string) string {
	return strings.Trim(strings.TrimSpace(prefix), "/")
}
