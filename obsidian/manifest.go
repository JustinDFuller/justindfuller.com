package obsidian

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"regexp"
	"strings"
)

const assetManifestPath = "asset-manifest.json"

var digestPattern = regexp.MustCompile(`^[0-9a-f]+$`)

type imageManifest struct {
	Version int                    `json:"version"`
	Images  map[string]imageRecord `json:"images"`
}

type imageRecord struct {
	SHA256      string `json:"sha256"`
	MD5         string `json:"md5"`
	Size        int64  `json:"size"`
	ContentType string `json:"contentType"`
	Key         string `json:"key"`
}

type imageResolveError struct {
	category string
}

func (e imageResolveError) Error() string { return e.category }

func manifestResolver(ctx context.Context, source Source, files []RemoteFile, baseURL string) (func(RemoteFile) (Asset, error), error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" || base.Path != "" {
		return nil, fmt.Errorf("%w: invalid media base URL", errInvalidSourceConfiguration)
	}
	var manifestFile RemoteFile
	for _, file := range files {
		if file.Path != assetManifestPath {
			continue
		}
		if manifestFile.ID != "" || file.IsFolder {
			return nil, errors.New("duplicate or invalid asset manifest")
		}
		manifestFile = file
	}
	if manifestFile.ID == "" {
		return nil, errors.New("asset manifest is missing")
	}
	raw, err := source.Download(ctx, manifestFile.ID)
	if err != nil {
		return nil, fmt.Errorf("read asset manifest: %w", err)
	}
	if len(raw) > 2<<20 {
		return nil, errors.New("asset manifest exceeds 2 MiB")
	}
	var manifest imageManifest
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil || manifest.Version != 1 || manifest.Images == nil {
		return nil, errors.New("invalid asset manifest")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, errors.New("asset manifest contains trailing data")
	}
	if len(manifest.Images) > 10000 {
		return nil, errors.New("asset manifest contains too many images")
	}
	return func(remote RemoteFile) (Asset, error) {
		record, ok := manifest.Images[remote.Path]
		if !ok || !validImageRecord(remote.Path, record) {
			return Asset{}, imageResolveError{category: "image_not_ready"}
		}
		md5Bytes, err := hex.DecodeString(record.MD5)
		if err != nil || remote.MD5 == "" || base64.StdEncoding.EncodeToString(md5Bytes) != remote.MD5 || remote.Size != record.Size {
			return Asset{}, imageResolveError{category: "image_not_ready"}
		}
		return Asset{
			Token:       imageToken(remote),
			FileID:      remote.ID,
			Path:        remote.Path,
			Revision:    remote.Revision,
			ContentType: record.ContentType,
			URL:         baseURL + "/" + record.Key,
		}, nil
	}, nil
}

func validImageRecord(logicalPath string, record imageRecord) bool {
	if !strings.HasPrefix(logicalPath, "image/") || !isSupportedImage(logicalPath) || path.Clean(logicalPath) != logicalPath || strings.Contains(logicalPath, "\\") || strings.ContainsAny(logicalPath, "?#") {
		return false
	}
	if len(record.SHA256) != 64 || len(record.MD5) != 32 || !digestPattern.MatchString(record.SHA256) || !digestPattern.MatchString(record.MD5) || record.Size <= 0 || record.Size > 20<<20 {
		return false
	}
	if record.ContentType != imageContentType(logicalPath) {
		return false
	}
	return record.Key == "v1/"+record.SHA256+path.Ext(logicalPath)
}
