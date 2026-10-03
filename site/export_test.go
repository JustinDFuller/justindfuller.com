package site

import (
	"os"
	"testing"
)

func TestValidateLinksDistinguishesStylesFromCodeExamples(t *testing.T) {
	cases := []struct {
		name    string
		html    string
		css     string
		wantErr bool
	}{
		{"code example", `<pre><code>url('/missing.png')</code></pre>`, "", false},
		{"script text", `<script>const example = "url('/missing.png')";</script>`, "", false},
		{"missing inline style asset", `<style>body{background:url('/missing.png')}</style>`, "", true},
		{"missing style attribute asset", `<div style="background:url('/missing.png')"></div>`, "", true},
		{"present inline asset", `<style>body{background:url('/present.png')}</style>`, "", false},
		{"missing stylesheet asset", `<link href="/main.css" rel="stylesheet">`, `body{background:url('/missing.png')}`, true},
		{"external asset", `<style>body{background:url('https://example.com/image.png')}</style>`, "", false},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			root, err := os.OpenRoot(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := root.Close(); err != nil {
					t.Error(err)
				}
			})
			if err := root.WriteFile("index.html", []byte(test.html), 0o600); err != nil {
				t.Fatal(err)
			}
			manifest := Manifest{Pages: []string{"/"}, Assets: []string{"/present.png"}}
			if test.css != "" {
				if err := root.WriteFile("main.css", []byte(test.css), 0o600); err != nil {
					t.Fatal(err)
				}
				manifest.Assets = append(manifest.Assets, "/main.css")
			}
			if err := validateLinks(root, manifest); (err != nil) != test.wantErr {
				t.Fatalf("validation error = %v, want error = %t", err, test.wantErr)
			}
		})
	}
}
