package programming

import (
	"bytes"
	"html/template"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEditorTypesAppearsInProgrammingIndex(t *testing.T) {
	old, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(".."); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
	entries, err := GetEntries()
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.Slug == "editor-types" && entry.Title == "Types of Editors" {
			return
		}
	}
	t.Fatal("editor-types missing from index")
}

func TestParseEditorPageOrdersAndRendersVariants(t *testing.T) {
	dir := t.TempDir()
	writeEditorFile(t, dir, "0-original-copy.md", "one, two\n")
	writeEditorFile(t, dir, "10-line-editor.md", "<!-- Prompt -->\n\nPrompt *markdown*.\n\n<!-- PlainTextResponse -->\n\nResponse **markdown**.\n")
	writeEditorFile(t, dir, "2-copy_editor.md", "<!-- Prompt -->\n\nPrompt.\n\n<!-- PlainTextResponse -->\n\nResponse.\n\n<!-- EditedCopy -->\n\none, three\n")
	writeEditorFile(t, dir, ".3-hidden.md", "bad")
	writeEditorFile(t, dir, "swap.md", "bad")
	page, err := parseEditorPage(dir, []byte("Before.\n\n<!--PlaceVariantsHere-->\n\nAfter."))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(page.Variants), 2; got != want {
		t.Fatalf("variants = %d, want %d", got, want)
	}
	if page.Variants[0].Name != "Copy Editor" || page.Variants[1].Name != "Line Editor" {
		t.Fatalf("unexpected order: %#v", page.Variants)
	}
	if got, want := page.Variants[0].AnchorID, "editor-variant-copy-editor"; got != want {
		t.Fatalf("first anchor ID = %q, want %q", got, want)
	}
	if page.Variants[0].Position != 1 || page.Variants[1].Position != 2 {
		t.Fatalf("positions = %d, %d; want 1, 2", page.Variants[0].Position, page.Variants[1].Position)
	}
	if !strings.Contains(string(page.Before), "Before") || !strings.Contains(string(page.After), "After") {
		t.Fatal("post content was not split around placement")
	}
	if !strings.Contains(string(page.Original), "one, two") {
		t.Fatal("original copy was not rendered")
	}
	if !strings.Contains(string(page.Variants[1].Prompt), "<em>markdown</em>") || !strings.Contains(string(page.Variants[1].Response), "<strong>markdown</strong>") {
		t.Fatal("variant markdown was not rendered")
	}
	if len(page.Variants[0].Diff) == 0 || page.Variants[1].Diff != nil {
		t.Fatal("optional edited copy diff handling is incorrect")
	}
}

func TestEditorVariantAnchorIDsMustBeUnique(t *testing.T) {
	dir := t.TempDir()
	writeEditorFile(t, dir, "0-original-copy.md", "original")
	writeEditorFile(t, dir, "1-copy-editor.md", validEditorVariant)
	writeEditorFile(t, dir, "2-copy_editor.md", validEditorVariant)
	if _, err := parseEditorPage(dir, []byte("<!--PlaceVariantsHere-->")); err == nil {
		t.Fatal("expected duplicate anchor ID error")
	}
}

func TestEditorComparisonTemplateRendersNavigationAndAccessibleCards(t *testing.T) {
	source, err := os.ReadFile(filepath.Join("..", "entry-page.template.html"))
	if err != nil {
		t.Fatal(err)
	}
	templates, err := template.New("/entry-page.template.html").Parse(string(source))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := templates.New("/entry-header.template.html").Parse("<header>{{ .Title }}</header>"); err != nil {
		t.Fatal(err)
	}
	page := &EditorPage{
		Before:   template.HTML("<p>Before <em>markup</em>.</p>"),
		After:    template.HTML("<p>After <strong>markup</strong>.</p>"),
		Original: template.HTML("<p>Original <em>markup</em>.</p>"),
		Variants: []EditorVariant{
			{AnchorID: "editor-variant-developmental", Name: "Developmental", Position: 1, Prompt: template.HTML("<p>Author <em>markup</em>.</p>"), Response: template.HTML("<p>Model <strong>markup</strong>.</p>"), Diff: []DiffHunk{{OldStart: 1, OldLines: 1, NewStart: 1, NewLines: 1}}},
			{AnchorID: "editor-variant-substantive", Name: "Substantive", Position: 2},
			{AnchorID: "editor-variant-line", Name: "Line", Position: 3},
		},
	}
	var rendered bytes.Buffer
	err = templates.ExecuteTemplate(&rendered, "/entry-page.template.html", map[string]any{
		"Entry":       Entry{Title: "Types of Editors", EditorPage: page},
		"ContentType": "programming",
	})
	if err != nil {
		t.Fatal(err)
	}
	html := rendered.String()
	for _, want := range []string{
		`id="editor-original"`,
		`aria-labelledby="editor-original-title"`,
		`<h2 id="editor-original-title">Original</h2>`,
		`id="editor-variant-developmental"`,
		`aria-labelledby="editor-variant-developmental-title"`,
		`0 out of 3`,
		`1 out of 3`,
		`2 out of 3`,
		`3 out of 3`,
		`class="editor-comparison__scroller"`,
		`aria-label="Editor comparison cards"`,
		`class="editor-message editor-message--author"`,
		`class="editor-message editor-message--model"`,
		`<h3 class="editor-message__label">Prompt</h3>`,
		`<h3 class="editor-message__label">Model</h3>`,
		`<h4>Diff</h4>`,
		`<p>Before <em>markup</em>.</p>`,
		`<p>After <strong>markup</strong>.</p>`,
		`<p>Original <em>markup</em>.</p>`,
		`<p>Author <em>markup</em>.</p>`,
		`<p>Model <strong>markup</strong>.</p>`,
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("rendered template missing %q:\n%s", want, html)
		}
	}
	if strings.Contains(html, "editor-comparison__nav") {
		t.Fatalf("rendered template includes removed editor navigation:\n%s", html)
	}
	modelStart := strings.Index(html, `class="editor-message editor-message--model"`)
	diffStart := strings.Index(html, `class="editor-variant__section editor-variant__section--diff"`)
	if modelStart == -1 || diffStart < modelStart {
		t.Fatalf("diff is not rendered inside the model message:\n%s", html)
	}
}

func TestEditorMarkerValidation(t *testing.T) {
	dir := t.TempDir()
	writeEditorFile(t, dir, "0-original-copy.md", "original")
	for _, post := range []string{"no marker", "<!--PlaceVariantsHere--><!--PlaceVariantsHere-->"} {
		if _, err := parseEditorPage(dir, []byte(post)); err == nil {
			t.Fatalf("expected placement validation error for %q", post)
		}
	}
	for _, variant := range []string{
		"<!-- Prompt -->\na",
		"<!-- PlainTextResponse -->\na\n<!-- Prompt -->\nb",
		"<!-- Prompt -->\na\n<!-- Prompt -->\nb\n<!-- PlainTextResponse -->\nc",
	} {
		if _, err := parseEditorVariant("bad", []byte(variant), []byte("original")); err == nil {
			t.Fatalf("expected section validation error for %q", variant)
		}
	}
}

func TestBuildDiffHighlightsAndEscapesSource(t *testing.T) {
	hunks := buildDiff("keep\nHello, <tag> world\nremove\n", "keep\nHello! <tag> universe\ninsert\n")
	if len(hunks) != 1 {
		t.Fatalf("hunks = %d, want 1", len(hunks))
	}
	var deleted, inserted bool
	for _, row := range hunks[0].Rows {
		if row.Kind == "delete" {
			deleted = true
		}
		if row.Kind == "insert" {
			inserted = true
		}
		for _, segment := range row.Segments {
			if strings.Contains(string(segment.Text), "&lt;tag&gt;") && !segment.Changed {
				t.Fatal("escaped tag should be part of changed replacement")
			}
		}
	}
	if !deleted || !inserted || hunks[0].OldStart != 1 || hunks[0].NewStart != 1 {
		t.Fatal("missing unified rows or line numbers")
	}
	if got := buildDiff("same", "same"); got != nil {
		t.Fatalf("identical copy should have no diff: %#v", got)
	}
}

func writeEditorFile(t *testing.T, directory, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(directory, name), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

const validEditorVariant = "<!-- Prompt -->\nPrompt\n<!-- PlainTextResponse -->\nResponse\n"
