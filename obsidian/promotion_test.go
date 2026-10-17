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

func TestMetadataOnlyImagePromotionFollowsPostEligibility(t *testing.T) {
	record := ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	images := map[string]ImageRecord{"image/cover.png": record}

	production := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/cover.png", "No body image")}, images), State{}, nil, ModeProduction)
	if len(production.Images) != 1 || production.Images[record.Key] != record {
		t.Fatalf("metadata-only image not promoted: %v", production.Issues)
	}
	if err := ValidateImagePromotion(production, nil); err != nil {
		t.Fatal(err)
	}

	for name, source := range map[string][]byte{
		"nonprod": imagePost("nonprod", "post", false, "image/cover.png", "No body image"),
		"draft":   imagePost("production", "post", true, "image/cover.png", "No body image"),
	} {
		t.Run(name, func(t *testing.T) {
			result := prepare(t, loaded(map[string][]byte{"p.md": source}, images), State{}, nil, ModeProduction)
			if len(result.Images) != 0 {
				t.Fatal("metadata-only image of an ineligible post was promoted")
			}
			forged := prepare(t, loaded(map[string][]byte{"p.md": post("production", "post", "add", "Body", false)}, images), State{}, nil, ModeProduction)
			forged.State.Files["p.md"] = source
			forged.State.FileImages["p.md"] = images
			forged.Images[record.Key] = record
			forged.Digest, _ = preparedDigest(forged)
			if err := ValidateImagePromotion(forged, nil); err == nil {
				t.Fatal("forged metadata-only promotion accepted")
			}
		})
	}
}

func TestPromotionRejectsMetadataImageThatDoesNotMatchEntry(t *testing.T) {
	record := ImageRecord{SHA256: strings.Repeat("a", 64), MD5: strings.Repeat("b", 32), Size: 17, ContentType: "image/png", Key: "v1/" + strings.Repeat("a", 64) + ".png"}
	images := map[string]ImageRecord{"image/cover.png": record}
	prepared := prepare(t, loaded(map[string][]byte{"p.md": imagePost("production", "post", false, "image/cover.png", "Body")}, images), State{}, nil, ModeProduction)
	prepared.Entries[0].Image = "https://media.justindfuller.com/v1/" + strings.Repeat("f", 64) + ".png"
	prepared.Digest, _ = preparedDigest(prepared)
	if err := ValidateImagePromotion(prepared, nil); err == nil {
		t.Fatal("an entry image that differs from the accepted source was accepted")
	}
}
