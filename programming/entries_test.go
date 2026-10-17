package programming

import (
	"encoding/json"
	"html/template"
	"testing"
	"time"
)

func TestParseEntryImage(t *testing.T) {
	tests := []struct {
		name        string
		frontMatter string
		want        string
	}{
		{name: "site path", frontMatter: "image: /image/programming/example.png", want: "/image/programming/example.png"},
		{name: "https url", frontMatter: "image: https://media.justindfuller.com/v1/abc.png", want: "https://media.justindfuller.com/v1/abc.png"},
		{name: "missing", frontMatter: "", want: ""},
		{name: "relative value", frontMatter: "image: image/example.png", want: ""},
		{name: "http value", frontMatter: "image: http://example.com/a.png", want: ""},
		{name: "non text value", frontMatter: "image: [/image/a.png]", want: ""},
		{name: "empty value", frontMatter: "image:", want: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			entry, err := parseEntry("2026-01-01_example.md", []byte("---\ntitle: Example\n"+test.frontMatter+"\n---\nBody\n"))
			if err != nil {
				t.Fatal(err)
			}
			if entry.Image != test.want {
				t.Fatalf("Image=%q want %q", entry.Image, test.want)
			}
		})
	}
}

func TestParseEntryMetadataIgnoresImage(t *testing.T) {
	entry := parseEntryMetadata("2026-01-01_example.md", []byte("---\ntitle: Example\nimage: /image/example.png\n---\nBody\n"))
	if entry.Image != "" {
		t.Fatalf("Image=%q want empty", entry.Image)
	}
	if entry.Title != "Example" {
		t.Fatalf("Title=%q", entry.Title)
	}
}

func TestEntryJSONWithoutImageIsUnchanged(t *testing.T) {
	type legacy struct {
		Title          string
		SubTitle       string
		Slug           string
		Description    string
		FirstParagraph string
		Content        template.HTML
		Date           time.Time
		IsDraft        bool
	}
	date := time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)
	got, err := json.Marshal(Entry{Title: "T", SubTitle: "S", Slug: "s", Description: "D", FirstParagraph: "F", Content: "<p>x</p>", Date: date, IsDraft: true, Image: ""})
	if err != nil {
		t.Fatal(err)
	}
	want, err := json.Marshal(legacy{Title: "T", SubTitle: "S", Slug: "s", Description: "D", FirstParagraph: "F", Content: "<p>x</p>", Date: date, IsDraft: true})
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Fatalf("json changed:\n got %s\nwant %s", got, want)
	}
}

func TestEntryJSONWithImageRoundTrips(t *testing.T) {
	raw, err := json.Marshal(Entry{Title: "T", SubTitle: "", Slug: "s", Description: "", FirstParagraph: "", Content: "", Date: time.Time{}, IsDraft: false, Image: "/image/a.png"})
	if err != nil {
		t.Fatal(err)
	}
	var decoded Entry
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Image != "/image/a.png" {
		t.Fatalf("Image=%q", decoded.Image)
	}
}

func TestFirstImage(t *testing.T) {
	tests := []struct {
		name    string
		content template.HTML
		want    Image
		found   bool
	}{
		{name: "no image", content: "<p>Hello</p>", found: false},
		{name: "empty content", content: "", found: false},
		{name: "first of several", content: `<figure><img src="/a.png" alt="First"></figure><img src="/b.png" alt="Second">`, want: Image{Src: "/a.png", Alt: "First"}, found: true},
		{name: "no alt", content: `<img src="/a.png">`, want: Image{Src: "/a.png", Alt: ""}, found: true},
		{name: "raw html self closing", content: `<p>x</p><img alt="Raw" src="https://media.justindfuller.com/v1/h.png" />`, want: Image{Src: "https://media.justindfuller.com/v1/h.png", Alt: "Raw"}, found: true},
		{name: "skips image without src", content: `<img alt="none"><img src="/b.png" alt="B">`, want: Image{Src: "/b.png", Alt: "B"}, found: true},
		{name: "unescapes attributes", content: `<img src="/a.png?x=1&amp;y=2" alt="A &amp; B">`, want: Image{Src: "/a.png?x=1&y=2", Alt: "A & B"}, found: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, found := FirstImage(test.content)
			if found != test.found || got != test.want {
				t.Fatalf("got %+v,%v want %+v,%v", got, found, test.want, test.found)
			}
		})
	}
}

func TestFindImage(t *testing.T) {
	content := template.HTML(`<img src="/a.png" alt="A"><img src="/b.png" alt="B"><img src="/b.png" alt="Again">`)
	got, found := FindImage(content, "/b.png")
	if !found || got != (Image{Src: "/b.png", Alt: "B"}) {
		t.Fatalf("got %+v,%v", got, found)
	}
	if _, found := FindImage(content, "/missing.png"); found {
		t.Fatal("found an image that is not in the content")
	}
	if _, found := FindImage(content, ""); found {
		t.Fatal("an empty source must not match")
	}
}

func TestImagesInCodeAreNotMatched(t *testing.T) {
	markdown := "---\ntitle: Example\n---\nUse `<img src=\"/inline.png\" alt=\"inline\">` inline.\n\n```html\n<img src=\"/block.png\" alt=\"block\">\n```\n\n```\n<img src=\"/plain.png\">\n```\n"
	entry, err := parseEntry("2026-01-01_example.md", []byte(markdown))
	if err != nil {
		t.Fatal(err)
	}
	if got, found := FirstImage(entry.Content); found {
		t.Fatalf("matched code text as an image: %+v", got)
	}
	if _, found := FindImage(entry.Content, "/block.png"); found {
		t.Fatal("matched a code block image by source")
	}
}

func TestRenderedMarkdownImages(t *testing.T) {
	markdown := "---\ntitle: Example\n---\nIntro\n\n![A diagram](/image/programming/diagram.png)\n\n<img src=\"/image/raw.png\" alt=\"Raw\">\n"
	entry, err := parseEntry("2026-01-01_example.md", []byte(markdown))
	if err != nil {
		t.Fatal(err)
	}
	got, found := FirstImage(entry.Content)
	if !found || got != (Image{Src: "/image/programming/diagram.png", Alt: "A diagram"}) {
		t.Fatalf("got %+v,%v", got, found)
	}
	raw, found := FindImage(entry.Content, "/image/raw.png")
	if !found || raw.Alt != "Raw" {
		t.Fatalf("got %+v,%v", raw, found)
	}
}
