package obsidian

import (
	"strings"
	"testing"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

func TestAcceptedFallbackRevalidatesCurrentCodeTargetsAndOwnership(t *testing.T) {
	git := []programming.Entry{{Slug: "git", Title: "Git", Content: "Git body"}}
	accepted := prepare(t, loaded(map[string][]byte{
		"p.md":    post("production", "post", "add", "Public body", false),
		"n.md":    post("nonprod", "private", "add", "Private body", false),
		"mask.md": post("production", "git", "overwrite", "Masked body", true),
	}, nil), State{}, git, ModeStaging)
	fallback, err := PrepareAccepted(accepted.State, git, ModeStaging, nil, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if fallback.Digest != accepted.Digest || fallback.Revision != accepted.Revision || len(fallback.State.Files) != 3 || len(fallback.Masks) != 1 {
		t.Fatal("source outage lost accepted content or masks")
	}
	if len(fallback.Issues) != 1 || fallback.Issues[0].Category != "source_degraded" {
		t.Fatal("source outage is not observable")
	}
	for _, mode := range []Mode{ModeProduction, ModePreview, ModeLocal} {
		if _, err := PrepareAccepted(accepted.State, git, mode, nil, time.Unix(0, 0)); err == nil {
			t.Fatal("cross-target state used as fallback")
		}
	}
	if _, err := PrepareAccepted(State{}, git, ModeStaging, nil, time.Unix(0, 0)); err == nil {
		t.Fatal("missing state silently bootstrapped")
	}
	if _, err := PrepareAccepted(accepted.State, append(git, programming.Entry{Slug: "post"}), ModeStaging, nil, time.Unix(0, 0)); err == nil {
		t.Fatal("changed ownership silently erased accepted content during outage")
	}
	accepted.State.Files["p.md"] = post("production", "post", "add", "<script>unsafe</script>", false)
	if _, err := PrepareAccepted(accepted.State, git, ModeStaging, nil, time.Unix(0, 0)); err == nil {
		t.Fatal("invalid accepted bytes reused")
	}
}

func TestAcceptedFallbackKeepsPerFileImageHistoryAndIsolatesUnavailableReferences(t *testing.T) {
	a := ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("c", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	b := ImageRecord{SHA256: strings.Repeat("b", 64), MD5: strings.Repeat("d", 32), Size: 18, ContentType: "image/png", Key: "v1/" + strings.Repeat("b", 64) + ".png"}
	initial := prepare(t, loaded(map[string][]byte{
		"a.md": post("production", "first", "add", "First ![image](image/shared.png)", false),
		"b.md": post("production", "second", "add", "Second ![image](image/shared.png)", false),
	}, map[string]ImageRecord{"image/shared.png": a}), State{}, nil, ModeProduction)
	next := loaded(map[string][]byte{
		"a.md": post("production", "first", "add", "<script>invalid edit</script>", false),
		"b.md": post("production", "second", "add", "New second ![image](image/shared.png)", false),
	}, map[string]ImageRecord{"image/shared.png": b})
	next.Ready[a.Key] = true
	accepted := prepare(t, next, initial.State, nil, ModeProduction)
	fallback, err := PrepareAccepted(accepted.State, nil, ModeProduction, nil, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if fallback.Digest != accepted.Digest || len(fallback.Images) != 2 {
		t.Fatal("fallback replaced an old per-file image revision with the current logical mapping")
	}
	isolated, err := PrepareAccepted(accepted.State, nil, ModeProduction, map[string]bool{a.Key: true}, time.Unix(0, 0))
	if err != nil || len(isolated.Entries) != 2 || len(isolated.Images) != 1 {
		t.Fatal("unavailable image removed valid post bodies")
	}
	if _, found := isolated.Images[a.Key]; found {
		t.Fatal("unavailable image remained rendered")
	}
	if err := ValidateImagePromotion(isolated, nil); err != nil {
		t.Fatal(err)
	}
	if isolated.State.FileImages["a.md"]["image/shared.png"] != a {
		t.Fatal("unavailable image lost its private per-file history")
	}
	recovered, err := PrepareAccepted(isolated.State, nil, ModeProduction, nil, time.Unix(0, 0))
	if err != nil || recovered.Digest != accepted.Digest || len(recovered.Images) != 2 {
		t.Fatal("image recovery failed to restore the distinct per-file revisions")
	}
	if err := ValidateImagePromotion(recovered, nil); err != nil {
		t.Fatal(err)
	}
	next.Ready[a.Key] = false
	notReady := prepare(t, next, accepted.State, nil, ModeProduction)
	if _, found := notReady.Images[a.Key]; found || notReady.State.FileImages["a.md"]["image/shared.png"] != a {
		t.Fatal("unready source image lost its history or remained renderable")
	}
	if err := ValidateImagePromotion(notReady, nil); err != nil {
		t.Fatal(err)
	}
	next.Ready[a.Key] = true
	readyAgain := prepare(t, next, notReady.State, nil, ModeProduction)
	if readyAgain.Digest != accepted.Digest || len(readyAgain.Images) != 2 {
		t.Fatal("normal source reconciliation lost an unavailable prior image revision")
	}
}
