package obsidian

import (
	"strings"
	"testing"
)

func TestPromotionAuthorizationRejectsNonprodDraftAndUnusedReferences(t *testing.T) {
	record := ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	images := map[string]ImageRecord{"image/test.png": record}
	production := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "![alt](image/test.png)", false)}, images), State{}, nil, ModeProduction)
	if err := ValidateImagePromotion(production, nil); err != nil {
		t.Fatal(err)
	}
	for _, environment := range []string{"nonprod", "production"} {
		forged := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, images), State{}, nil, ModeProduction)
		forged.State.Files["p.md"] = post(environment, "post", "add", "![alt](image/test.png)", environment == "production")
		forged.State.FileImages["p.md"] = images
		forged.Images[record.Key] = record
		forged.Digest, _ = preparedDigest(forged)
		if err := ValidateImagePromotion(forged, nil); err == nil {
			t.Fatalf("unauthorized %s image promotion accepted", environment)
		}
	}
	unused := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, images), State{}, nil, ModeProduction)
	unused.Images[record.Key] = record
	unused.State.FileImages["p.md"] = images
	unused.Digest, _ = preparedDigest(unused)
	if err := ValidateImagePromotion(unused, nil); err == nil {
		t.Fatal("unused source image authorized")
	}
}
