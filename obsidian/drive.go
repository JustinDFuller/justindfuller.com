package obsidian

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"path"
	"sort"
	"strings"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const driveFolderMimeType = "application/vnd.google-apps.folder"

type driveSource struct {
	service *drive.Service
}

func newDriveSource(ctx context.Context, config Config) (Source, error) {
	var client *http.Client
	if config.Environment == EnvironmentLocal {
		var err error
		client, err = newDriveHTTPClient(ctx, config)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", errInvalidSourceConfiguration, err)
		}
	}

	options := []option.ClientOption{option.WithScopes(drive.DriveReadonlyScope)}
	if client != nil {
		options = append(options, option.WithHTTPClient(client))
	}
	service, err := drive.NewService(ctx, options...)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errInvalidSourceConfiguration, err)
	}

	return &driveSource{service: service}, nil
}

func (s *driveSource) Read(ctx context.Context, folderID string) (SourceTree, error) {
	if folderID == "" || strings.Contains(folderID, "'") {
		return SourceTree{}, fmt.Errorf("%w: invalid Drive folder configuration", errInvalidSourceConfiguration)
	}

	files := make([]RemoteFile, 0)
	if err := s.readFolder(ctx, folderID, "", &files); err != nil {
		return SourceTree{}, err
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].Path == files[j].Path {
			return files[i].ID < files[j].ID
		}
		return files[i].Path < files[j].Path
	})

	return SourceTree{Files: files}, nil
}

func (s *driveSource) readFolder(ctx context.Context, folderID, prefix string, files *[]RemoteFile) error {
	pageToken := ""
	for {
		call := s.service.Files.List().
			Q(fmt.Sprintf("'%s' in parents and trashed = false", folderID)).
			Fields("nextPageToken,files(id,name,mimeType,version,modifiedTime,md5Checksum,size)").
			PageSize(1000).
			OrderBy("name")
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}

		page, err := call.Context(ctx).Do()
		if err != nil {
			return err
		}

		for _, file := range page.Files {
			filePath := file.Name
			if prefix != "" {
				filePath = path.Join(prefix, file.Name)
			}

			revision := file.Version
			if revision == 0 && file.ModifiedTime != "" {
				revision = 1
			}

			md5Value := ""
			if digest, err := hex.DecodeString(file.Md5Checksum); err == nil && len(digest) == 16 {
				md5Value = base64.StdEncoding.EncodeToString(digest)
			}
			*files = append(*files, RemoteFile{
				ID:       file.Id,
				Name:     file.Name,
				Path:     filePath,
				Revision: fmt.Sprintf("%d:%s", revision, file.ModifiedTime),
				MimeType: file.MimeType,
				MD5:      md5Value,
				Size:     file.Size,
				IsFolder: file.MimeType == driveFolderMimeType,
			})

			if file.MimeType == driveFolderMimeType {
				if err := s.readFolder(ctx, file.Id, filePath, files); err != nil {
					return err
				}
			}
		}

		pageToken = page.NextPageToken
		if pageToken == "" {
			return nil
		}
	}
}

func (s *driveSource) Download(ctx context.Context, fileID string) ([]byte, error) {
	response, err := s.service.Files.Get(fileID).Context(ctx).Download()
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(response.Body, maxSourceDownloadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxSourceDownloadBytes {
		return nil, fmt.Errorf("%w: Drive object exceeds %d bytes", errSourceObjectTooLarge, maxSourceDownloadBytes)
	}
	return data, nil
}
