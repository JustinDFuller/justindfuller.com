package obsidian

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/justindfuller/justindfuller.com/programming"
)

func TestProtectedReportRecordsOwnershipWithoutBodies(t *testing.T) {
	source := loaded(map[string][]byte{"z.md": post("nonprod", "private-canary", "add", "private raw body canary", false), "a.md": post("production", "git", "overwrite", "private draft body canary", true)}, nil)
	prepared := prepare(t, source, State{}, []programming.Entry{{Slug: "git", Content: "Git"}}, ModeStaging)
	report, err := ReportPrepared(prepared)
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Files) != 2 || report.Files[0].Path != "a.md" || !report.Files[0].Draft || report.Files[0].Sync != "overwrite" || report.Files[1].Environment != EnvironmentNonprod || len(report.Masks) != 1 {
		t.Fatal("report lost target, ownership or draft-mask metadata")
	}
	body, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"private raw body canary", "private draft body canary", "Content", "base64", "fileImages"} {
		if strings.Contains(string(body), forbidden) {
			t.Fatal("protected report contains a post body or complete state")
		}
	}
	prepared.State.Files["z.md"] = post("nonprod", "private-canary", "add", "private raw body canary", false)
	prepared.Mode = ModeProduction
	prepared.State.Mode = ModeProduction
	prepared.Digest, _ = preparedDigest(prepared)
	if _, err := ReportPrepared(prepared); err == nil {
		t.Fatal("report accepted ineligible ownership metadata")
	}
}
