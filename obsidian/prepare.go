package obsidian

import (
	"encoding/json"
	"errors"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

func Prepare(source LoadedSource, previous State, local []programming.Entry, mode Mode, now time.Time) (Prepared, error) {
	if !mode.Valid() {
		return Prepared{}, errors.New("invalid deployment mode")
	}
	if err := ValidateSnapshot(source.Snapshot); err != nil {
		return Prepared{}, err
	}
	canonical, err := CanonicalSnapshot(source.Snapshot)
	if err != nil || source.Revision != SHA256(canonical) || len(source.Bodies) != len(source.Snapshot.Files) {
		return Prepared{}, errors.New("source integrity failure")
	}
	for name, record := range source.Snapshot.Files {
		raw, found := source.Bodies[name]
		if !found || int64(len(raw)) != record.Size || SHA256(raw) != record.SHA256 {
			return Prepared{}, errors.New("source file integrity failure")
		}
	}
	if previous.Version != 0 && (previous.Version != 1 || previous.Mode != mode || previous.Files == nil || previous.Images == nil || previous.FileImages == nil) {
		return Prepared{}, errors.New("accepted state incompatible with deployment")
	}
	localRoutes := make(map[string]int)
	for _, entry := range local {
		localRoutes[entry.Slug]++
	}
	lastGood := make(map[string]candidate)
	current := make(map[string]candidate)
	issues := make(map[string]Issue)
	parse := func(name string, raw []byte, images map[string]ImageRecord) (candidate, []Issue) {
		file := RemoteFile{ID: name, Name: name, Path: name, Revision: SHA256(raw), Size: int64(len(raw))}
		files := make([]RemoteFile, 0, len(images))
		for name, record := range images {
			files = append(files, RemoteFile{ID: record.Key, Name: path.Base(name), Path: name, Revision: record.SHA256, Size: record.Size, MD5: record.MD5, MimeType: record.ContentType})
		}
		used := map[string]ImageRecord{}
		resolve := func(remote RemoteFile) (Asset, error) {
			record, found := images[remote.Path]
			if !found || !validImageRecord(remote.Path, record) || !source.Ready[record.Key] {
				return Asset{}, imageResolveError{category: "image_not_ready"}
			}
			used[remote.Path] = record
			base := "/__obsidian/media/"
			if mode == ModeProduction {
				base = "https://media.justindfuller.com/"
			}
			return Asset{URL: base + record.Key}, nil
		}
		parsed, foundIssues := validateMarkdown(file, raw, buildAssetIndex(files), resolve, now)
		parsed.Raw = raw
		parsed.Images = used
		return parsed, foundIssues
	}
	for name, raw := range previous.Files {
		if _, present := source.Snapshot.Files[name]; !present {
			continue
		}
		front, _, err := splitFrontMatter(string(source.Bodies[name]))
		if err == nil {
			metadata, err := parseMetadata(front)
			if err == nil && !environmentEligible(metadata.Environment, mode) {
				continue
			}
		}
		parsed, _ := parse(name, raw, previous.FileImages[name])
		if parsed.File.ID != "" && environmentEligible(parsed.Environment, mode) {
			lastGood[name] = parsed
		}
	}
	for name, raw := range source.Bodies {
		front, _, err := splitFrontMatter(string(raw))
		if err == nil {
			metadata, err := parseMetadata(front)
			if err == nil && !environmentEligible(metadata.Environment, mode) {
				continue
			}
		}
		parsed, fileIssues := parse(name, raw, source.Snapshot.Images)
		for _, issue := range fileIssues {
			issues[issue.Key] = issue
		}
		if parsed.File.ID != "" && environmentEligible(parsed.Environment, mode) {
			current[name] = parsed
		} else if fallback, found := lastGood[name]; found {
			current[name] = fallback
			file := RemoteFile{ID: name, Path: name, Revision: SHA256(raw)}
			issue := fileIssue(file, "last_known_good", "retaining eligible accepted revision", now)
			issue.Fallback = "last_known_good_external"
			issues[issue.Key] = issue
		}
	}
	active, masked := applyPublicationPolicy(current, localRoutes, lastGood, &issues, now)
	result := Prepared{Version: 1, Mode: mode, Revision: source.Revision, Entries: []programming.Entry{}, Masks: []string{}, Images: map[string]ImageRecord{}, Issues: []Issue{}, State: State{FileImages: map[string]map[string]ImageRecord{}, Version: 1, Mode: mode, Revision: source.Revision, Files: map[string][]byte{}, Images: map[string]ImageRecord{}}}
	replaced := map[string]bool{}
	accept := func(parsed candidate, visible bool) {
		result.State.Files[parsed.File.ID] = parsed.Raw
		result.State.FileImages[parsed.File.ID] = parsed.Images
		replaced[parsed.Entry.Slug] = true
		if visible {
			result.Entries = append(result.Entries, parsed.Entry)
			for _, record := range parsed.Images {
				result.Images[record.Key] = record
			}
		} else {
			result.Masks = append(result.Masks, parsed.Entry.Slug)
		}
	}
	for _, parsed := range active {
		accept(parsed, true)
	}
	for _, parsed := range masked {
		accept(parsed, false)
	}
	for _, entry := range local {
		if !replaced[entry.Slug] && !entry.IsDraft {
			result.Entries = append(result.Entries, entry)
		}
	}
	for name, record := range source.Snapshot.Images {
		result.State.Images[name] = record
	}
	for _, issue := range issues {
		result.Issues = append(result.Issues, issue)
	}
	sortIssues(result.Issues)
	sort.Strings(result.Masks)
	sort.Slice(result.Entries, func(i, j int) bool {
		if result.Entries[i].Date.Equal(result.Entries[j].Date) {
			return result.Entries[i].Slug < result.Entries[j].Slug
		}
		return result.Entries[i].Date.After(result.Entries[j].Date)
	})
	result.Digest, err = preparedDigest(result)
	if err != nil {
		return Prepared{}, err
	}
	return result, nil
}

func preparedDigest(result Prepared) (string, error) {
	digestBody, err := json.Marshal(struct {
		Mode    Mode
		Entries []programming.Entry
		Masks   []string
		Images  map[string]ImageRecord
	}{result.Mode, result.Entries, result.Masks, result.Images})
	if err != nil {
		return "", err
	}
	return SHA256(digestBody), nil
}

func ValidatePrepared(prepared Prepared, mode Mode) error {
	if prepared.Version != 1 || prepared.Mode != mode || !mode.Valid() || prepared.State.Version != 1 || prepared.State.Mode != mode || prepared.State.Revision != prepared.Revision || prepared.Images == nil || prepared.State.Files == nil || prepared.State.Images == nil || prepared.State.FileImages == nil {
		return errors.New("prepared overlay mode mismatch")
	}
	digest, err := preparedDigest(prepared)
	if err != nil || digest != prepared.Digest {
		return errors.New("prepared overlay integrity failure")
	}
	routes := map[string]bool{}
	for _, slug := range prepared.Masks {
		if slug == "" || strings.ContainsAny(slug, "/\\\x00") || routes[slug] {
			return errors.New("invalid prepared mask")
		}
		routes[slug] = true
	}
	for _, entry := range prepared.Entries {
		if entry.IsDraft || entry.Slug == "" || strings.ContainsAny(entry.Slug, "/\\\x00") || routes[entry.Slug] {
			return errors.New("invalid prepared route")
		}
		routes[entry.Slug] = true
	}
	for key, record := range prepared.Images {
		if key != record.Key || !validImageRecord("image/"+path.Base(key), record) {
			return errors.New("invalid prepared image")
		}
	}
	return nil
}
