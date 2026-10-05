package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/justindfuller/justindfuller.com/obsidian"
)

type sourceReader struct {
	objects map[string][]byte
	err     error
}

func (r sourceReader) Read(_ context.Context, key string, _ int64) ([]byte, error) {
	if r.err != nil {
		return nil, r.err
	}
	value, ok := r.objects[key]
	if !ok {
		return nil, errors.New("missing object")
	}
	return value, nil
}

func (sourceReader) Head(context.Context, string) (obsidian.ObjectMetadata, error) {
	return obsidian.ObjectMetadata{}, errors.New("unexpected image metadata request")
}

func sourceObjects() (sourceReader, string) {
	snapshot := obsidian.SourceSnapshot{Version: 1, Files: map[string]obsidian.FileRecord{}, Images: map[string]obsidian.ImageRecord{}}
	encoded, _ := obsidian.CanonicalSnapshot(snapshot)
	revision := obsidian.SHA256(encoded)
	pointer, _ := json.Marshal(struct {
		Version  int    `json:"version"`
		Revision string `json:"revision"`
	}{Version: 1, Revision: revision})
	return sourceReader{objects: map[string][]byte{
		"latest.json":                     pointer,
		"snapshots/" + revision + ".json": encoded,
	}}, revision
}

func TestPinSourceWritesOnlyPrivateSanitizedSourceOutput(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	reader, revision := sourceObjects()
	source, err := pinSource(t.Context(), reader, obsidian.State{}, ".obsidian-publish/hosted/staging/pinned.json")
	if err != nil || source.Revision != revision {
		t.Fatalf("source pin failed: %v", err)
	}
	path := filepath.Join(dir, ".obsidian-publish/hosted/staging/pinned.json")
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("pinned source permissions differ: %v", err)
	}
	body, err := os.ReadFile(path)
	if err != nil || !strings.Contains(string(body), revision) {
		t.Fatalf("pinned source output unavailable: %v", err)
	}
}

func TestPinSourceClassifiesOnlySourceReadFailuresAsUnavailable(t *testing.T) {
	t.Chdir(t.TempDir())
	_, err := pinSource(t.Context(), sourceReader{err: errors.New("transport detail canary")}, obsidian.State{}, ".obsidian-publish/pinned.json")
	var sourceFailure sourceReadFailure
	if !errors.As(err, &sourceFailure) || strings.Contains(err.Error(), "canary") {
		t.Fatalf("source read failure was not safely classified: %v", err)
	}
	if exitCode(err) != 10 {
		t.Fatalf("source read failure exit code differs: %d", exitCode(err))
	}
	_, err = pinSource(t.Context(), sourceReader{}, obsidian.State{}, "outside.json")
	if err == nil || errors.As(err, &sourceFailure) || exitCode(err) != 1 {
		t.Fatalf("output path error was classified as source outage: %v", err)
	}
}

func TestPrivatePathRejectsOutsideAndSymlinkedPaths(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	if _, err := privatePath(filepath.Join(dir, "outside.json")); err == nil {
		t.Fatal("outside private path accepted")
	}
	if _, err := privatePath(".obsidian-publish"); err == nil {
		t.Fatal("private root itself accepted as file")
	}
	if err := os.MkdirAll(".obsidian-publish", 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(dir, ".obsidian-publish/linked"); err != nil {
		t.Fatal(err)
	}
	if _, err := privatePath(".obsidian-publish/linked/pinned.json"); err == nil {
		t.Fatal("symlinked output path accepted")
	}
}

func TestPinCommandConfigurationFailuresAreNotSourceOutages(t *testing.T) {
	t.Chdir(t.TempDir())
	err := run([]string{"--out", ".obsidian-publish/pinned.json"}, func(string) string { return "" })
	var sourceFailure sourceReadFailure
	if err == nil || errors.As(err, &sourceFailure) {
		t.Fatalf("configuration error was classified as source outage: %v", err)
	}
	if exitCode(err) != 1 {
		t.Fatalf("configuration error exit code differs: %d", exitCode(err))
	}
}
