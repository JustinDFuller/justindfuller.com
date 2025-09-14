// Package renderer provides custom Goldmark renderers
package renderer

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/util"
)

// ImageRenderer is a custom renderer for images that includes alt text as a caption
type ImageRenderer struct{}

// NewImageRenderer returns a new ImageRenderer
func NewImageRenderer() *ImageRenderer {
	return &ImageRenderer{}
}

// RegisterFuncs registers the custom image renderer
func (r *ImageRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(ast.KindImage, r.renderImage)
}

// extractAltText extracts the alt text from an Image node's children
func extractAltText(img *ast.Image, source []byte) []byte {
	var buf []byte
	for c := img.FirstChild(); c != nil; c = c.NextSibling() {
		if text, ok := c.(*ast.Text); ok {
			buf = append(buf, text.Value(source)...)
		} else if str, ok := c.(*ast.String); ok {
			buf = append(buf, str.Value...)
		}
	}
	return buf
}

func (r *ImageRenderer) renderImage(w util.BufWriter, source []byte, n ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}

	img, ok := n.(*ast.Image)
	if !ok {
		return ast.WalkContinue, nil
	}

	// Start figure element
	_, _ = w.WriteString("<figure class=\"image-with-caption\">\n")

	// Render the image
	_, _ = w.WriteString("<img src=\"")
	if img.Destination != nil {
		_, _ = w.Write(util.EscapeHTML(util.URLEscape(img.Destination, true)))
	}
	_, _ = w.WriteString("\"")

	// Add alt text attribute
	altText := extractAltText(img, source)
	if img.Title != nil || len(altText) > 0 {
		_, _ = w.WriteString(" alt=\"")
		if img.Title != nil {
			_, _ = w.Write(util.EscapeHTML(img.Title))
		} else {
			_, _ = w.Write(util.EscapeHTML(altText))
		}
		_, _ = w.WriteString("\"")
	}

	// Add title attribute if present
	if img.Title != nil {
		_, _ = w.WriteString(" title=\"")
		_, _ = w.Write(util.EscapeHTML(img.Title))
		_, _ = w.WriteString("\"")
	}

	_, _ = w.WriteString(" />\n")

	// Add figcaption with alt text if it exists
	if len(altText) > 0 && string(altText) != "" {
		_, _ = w.WriteString("<figcaption class=\"image-caption\">")
		_, _ = w.Write(util.EscapeHTML(altText))
		_, _ = w.WriteString("</figcaption>\n")
	}

	// Close figure element
	_, _ = w.WriteString("</figure>\n")

	return ast.WalkSkipChildren, nil
}

// Extension is a Goldmark extension that replaces the default image renderer
type Extension struct{}

// Extend extends the given Goldmark instance with the custom image renderer
func (e *Extension) Extend(m goldmark.Markdown) {
	m.Renderer().AddOptions(
		renderer.WithNodeRenderers(
			util.Prioritized(NewImageRenderer(), 100),
		),
	)
}

// NewExtension returns a new Extension
func NewExtension() goldmark.Extender {
	return &Extension{}
}

// WithImageRenderer returns a Goldmark option that uses the custom image renderer
func WithImageRenderer() goldmark.Option {
	return goldmark.WithRendererOptions(
		html.WithUnsafe(),
		renderer.WithNodeRenderers(
			util.Prioritized(NewImageRenderer(), 100),
		),
	)
}