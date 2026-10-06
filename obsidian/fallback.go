package obsidian

import (
	"errors"
	"path"
	"regexp"
	"sort"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

func PrepareAccepted(previous State, local []programming.Entry, mode Mode, unavailable map[string]bool, now time.Time) (Prepared, error) {
	if !mode.Valid() || previous.Version != 1 || previous.Mode != mode || previous.Files == nil || previous.Images == nil || previous.FileImages == nil || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(previous.Revision) {
		return Prepared{}, errors.New("usable accepted state required for source fallback")
	}
	snapshot := SourceSnapshot{Version: 1, Files: map[string]FileRecord{}, Images: previous.Images}
	for name, raw := range previous.Files {
		hash := SHA256(raw)
		snapshot.Files[name] = FileRecord{Key: "markdown/v1/" + hash + ".md", SHA256: hash, Size: int64(len(raw))}
	}
	if err := ValidateSnapshot(snapshot); err != nil {
		return Prepared{}, err
	}
	localRoutes := map[string]int{}
	for _, entry := range local {
		localRoutes[entry.Slug]++
	}
	current := map[string]candidate{}
	issues := map[string]Issue{}
	for name, raw := range previous.Files {
		file := RemoteFile{ID: name, Name: name, Path: name, Revision: SHA256(raw), Size: int64(len(raw))}
		images := previous.FileImages[name]
		files := []RemoteFile{}
		for logical, record := range images {
			if !validImageRecord(logical, record) {
				return Prepared{}, errors.New("accepted image metadata cannot be revalidated")
			}
			files = append(files, RemoteFile{ID: record.Key, Name: path.Base(logical), Path: logical, Revision: record.SHA256, Size: record.Size, MD5: record.MD5, MimeType: record.ContentType})
		}
		used := map[string]ImageRecord{}
		history := map[string]ImageRecord{}
		parsed, foundIssues := validateMarkdown(file, raw, buildAssetIndex(files), func(remote RemoteFile) (Asset, error) {
			record, found := images[remote.Path]
			if !found {
				return Asset{}, imageResolveError{category: "image_not_ready"}
			}
			history[remote.Path] = record
			if unavailable[record.Key] {
				return Asset{}, imageResolveError{category: "image_not_ready"}
			}
			used[remote.Path] = record
			base := "/__obsidian/media/"
			if mode == ModeProduction {
				base = "https://media.justindfuller.com/"
			}
			return Asset{URL: base + record.Key}, nil
		}, now)
		if parsed.File.ID == "" || !environmentEligible(parsed.Environment, mode) {
			return Prepared{}, errors.New("accepted content cannot be revalidated for this target")
		}
		parsed.Raw = raw
		parsed.Images = used
		parsed.ImageHistory = history
		current[name] = parsed
		for _, issue := range foundIssues {
			issues[issue.Key] = issue
		}
	}
	active, masked := applyPublicationPolicy(current, localRoutes, current, &issues, now)
	if len(active)+len(masked) != len(current) {
		return Prepared{}, errors.New("accepted ownership cannot be revalidated during source outage")
	}
	result := Prepared{Version: 1, Mode: mode, Revision: previous.Revision, Entries: []programming.Entry{}, Masks: []string{}, Images: map[string]ImageRecord{}, Issues: []Issue{}, State: State{Version: 1, Mode: mode, Revision: previous.Revision, Files: map[string][]byte{}, Images: previous.Images, FileImages: map[string]map[string]ImageRecord{}}}
	replaced := map[string]bool{}
	for _, parsed := range active {
		result.State.Files[parsed.File.ID] = parsed.Raw
		result.State.FileImages[parsed.File.ID] = parsed.ImageHistory
		result.Entries = append(result.Entries, parsed.Entry)
		replaced[parsed.Entry.Slug] = true
		for _, record := range parsed.Images {
			result.Images[record.Key] = record
		}
	}
	for _, parsed := range masked {
		result.State.Files[parsed.File.ID] = parsed.Raw
		result.State.FileImages[parsed.File.ID] = parsed.ImageHistory
		result.Masks = append(result.Masks, parsed.Entry.Slug)
		replaced[parsed.Entry.Slug] = true
	}
	for _, entry := range local {
		if !replaced[entry.Slug] && !entry.IsDraft {
			result.Entries = append(result.Entries, entry)
		}
	}
	degraded := fileIssue(RemoteFile{ID: "source", Revision: previous.Revision}, "source_degraded", "using revalidated accepted content while the source is unavailable", now)
	issues[degraded.Key] = degraded
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
	digest, err := preparedDigest(result)
	result.Digest = digest
	return result, err
}
