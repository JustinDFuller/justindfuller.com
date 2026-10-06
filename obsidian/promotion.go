package obsidian

import (
	"encoding/json"
	"errors"
	"path"
	"reflect"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

func ValidateImagePromotion(prepared Prepared, local []programming.Entry) error {
	if err := ValidatePrepared(prepared, ModeProduction); err != nil {
		return err
	}
	candidates := map[string]candidate{}
	localRoutes := map[string]int{}
	for _, entry := range local {
		localRoutes[entry.Slug]++
	}
	for name, raw := range prepared.State.Files {
		file := RemoteFile{ID: name, Name: name, Path: name, Revision: SHA256(raw), Size: int64(len(raw))}
		images := prepared.State.FileImages[name]
		files := []RemoteFile{}
		for logical, record := range images {
			if !validImageRecord(logical, record) {
				return errors.New("invalid accepted image metadata")
			}
			files = append(files, RemoteFile{ID: record.Key, Name: path.Base(logical), Path: logical, Revision: record.SHA256, Size: record.Size, MD5: record.MD5, MimeType: record.ContentType})
		}
		used := map[string]ImageRecord{}
		parsed, _ := validateMarkdown(file, raw, buildAssetIndex(files), func(remote RemoteFile) (Asset, error) {
			record, found := images[remote.Path]
			if !found || prepared.Images[record.Key] != record {
				return Asset{}, imageResolveError{category: "image_not_ready"}
			}
			used[record.Key] = record
			return Asset{URL: "https://media.justindfuller.com/" + record.Key}, nil
		}, time.Unix(0, 0))
		if parsed.File.ID == "" || parsed.Environment != EnvironmentProduction {
			return errors.New("accepted image source is not valid production content")
		}
		parsed.Images = used
		candidates[name] = parsed
	}
	issues := map[string]Issue{}
	active, _ := applyPublicationPolicy(candidates, localRoutes, candidates, &issues, time.Unix(0, 0))
	authorized := map[string]ImageRecord{}
	visible := map[string]programming.Entry{}
	for _, entry := range prepared.Entries {
		visible[entry.Slug] = entry
	}
	for _, parsed := range active {
		actual, found := visible[parsed.Entry.Slug]
		actualBody, err := json.Marshal(actual)
		if err != nil {
			return err
		}
		expectedBody, err := json.Marshal(parsed.Entry)
		if err != nil || !found || string(actualBody) != string(expectedBody) {
			return errors.New("image source does not match effective accepted content")
		}
		for key, record := range parsed.Images {
			authorized[key] = record
		}
	}
	if !reflect.DeepEqual(authorized, prepared.Images) {
		return errors.New("image promotion includes unauthorized references")
	}
	return nil
}
