package site

import (
	"html/template"
	"testing"

	"github.com/justindfuller/justindfuller.com/programming"
)

func TestAbsoluteImageURL(t *testing.T) {
	tests := []struct {
		value string
		want  string
	}{
		{value: "/image/example.png", want: "https://www.justindfuller.com/image/example.png"},
		{value: "/__obsidian/media/v1/abc.png", want: "https://www.justindfuller.com/__obsidian/media/v1/abc.png"},
		{value: "https://media.justindfuller.com/v1/abc.png", want: "https://media.justindfuller.com/v1/abc.png"},
		{value: "http://example.com/a.png", want: ""},
		{value: "image/example.png", want: ""},
		{value: "", want: ""},
	}
	for _, test := range tests {
		t.Run(test.value, func(t *testing.T) {
			if got := absoluteImageURL(test.value); got != test.want {
				t.Fatalf("got %q want %q", got, test.want)
			}
		})
	}
}

func TestPreviewImage(t *testing.T) {
	body := template.HTML(`<figure><img src="https://media.justindfuller.com/v1/first.png" alt="First alt"></figure><figure><img src="/image/second.png" alt="Second alt"></figure>`)
	tests := []struct {
		name    string
		entry   programming.Entry
		wantSrc string
		wantAlt string
	}{
		{name: "image value wins over body images", entry: programming.Entry{Image: "/image/second.png", Content: body}, wantSrc: "https://www.justindfuller.com/image/second.png", wantAlt: "Second alt"},
		{name: "image value not in the body has no alt", entry: programming.Entry{Image: "/image/other.png", Content: body}, wantSrc: "https://www.justindfuller.com/image/other.png"},
		{name: "media image value is unchanged", entry: programming.Entry{Image: "https://media.justindfuller.com/v1/other.png", Content: body}, wantSrc: "https://media.justindfuller.com/v1/other.png"},
		{name: "first body image without image value", entry: programming.Entry{Content: body}, wantSrc: "https://media.justindfuller.com/v1/first.png", wantAlt: "First alt"},
		{name: "relative body image is absolutized", entry: programming.Entry{Content: `<img src="/image/rel.png" alt="Rel">`}, wantSrc: "https://www.justindfuller.com/image/rel.png", wantAlt: "Rel"},
		{name: "body image without alt", entry: programming.Entry{Content: `<img src="/image/rel.png">`}, wantSrc: "https://www.justindfuller.com/image/rel.png"},
		{name: "unusable image value falls back to the first body image", entry: programming.Entry{Image: "image/relative.png", Content: body}, wantSrc: "https://media.justindfuller.com/v1/first.png", wantAlt: "First alt"},
		{name: "unusable image value and no body image", entry: programming.Entry{Image: "image/relative.png", Content: "<p>Text</p>"}},
		{name: "no images at all", entry: programming.Entry{Content: "<p>Text</p>"}},
		{name: "image-like text in code is ignored", entry: programming.Entry{Content: `<pre><code>&lt;img src=&#34;/image/code.png&#34;&gt;</code></pre>`}},
		{name: "unusable first body image", entry: programming.Entry{Content: `<img src="http://example.com/a.png" alt="A">`}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			src, alt := previewImage(test.entry)
			if src != test.wantSrc || alt != test.wantAlt {
				t.Fatalf("got (%q, %q) want (%q, %q)", src, alt, test.wantSrc, test.wantAlt)
			}
		})
	}
}
