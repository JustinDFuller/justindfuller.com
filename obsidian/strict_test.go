package obsidian

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPreparedIntegrityAndTargetValidation(t *testing.T) {
	prepared := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, nil), State{}, nil, ModeStaging)
	if err := ValidatePrepared(prepared, ModeStaging); err != nil {
		t.Fatal(err)
	}
	if err := ValidatePrepared(prepared, ModeProduction); err == nil {
		t.Fatal("cross-target overlay allowed")
	}
	prepared.Entries[0].Content = "Changed without preparation"
	if err := ValidatePrepared(prepared, ModeStaging); err == nil {
		t.Fatal("altered overlay accepted")
	}
}

func TestCanonicalSnapshotEncodingAndNormalizedBytesAreRejected(t *testing.T) {
	source := loaded(map[string][]byte{"é.md": post("production", "post", "add", "Body", false), "<&\u2028.md": post("production", "another", "add", "Body", false)}, nil)
	canonical, err := CanonicalSnapshot(source.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(canonical), `\u003c`) || !strings.Contains(string(canonical), `\u2028`) {
		t.Fatal("canonical encoding differs from publisher contract")
	}
	pointer, _ := json.Marshal(map[string]any{"version": 1, "revision": source.Revision})
	objects := memoryObjects{objects: map[string][]byte{"latest.json": pointer, "snapshots/" + source.Revision + ".json": append([]byte(" "), canonical...)}}
	if _, err := ReadSource(t.Context(), &objects); err == nil {
		t.Fatal("noncanonical immutable source accepted")
	}
}

func TestControlFieldNamesAreCaseSensitive(t *testing.T) {
	for _, raw := range []string{`{"Version":1,"files":{},"images":{}}`, `{"version":1,"files":{},"images":{},"Version":1}`, `{"version":1,"files":{"post.md":{"Key":"secret","sha256":"","size":0}},"images":{}}`} {
		var snapshot SourceSnapshot
		if DecodeStrict([]byte(raw), &snapshot) == nil {
			t.Fatal("unknown case-variant control field accepted")
		}
	}
}
