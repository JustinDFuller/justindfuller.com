// Package syntax provides code syntax highlighting for the website
package syntax

import (
	"bytes"
	"fmt"

	"github.com/alecthomas/chroma/v2"
	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/yuin/goldmark"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
)

// CustomDarkStyle is a custom dark theme matching the site's color scheme
var CustomDarkStyle = func() *chroma.Style {
	return styles.Register(chroma.MustNewStyle("custom-dark", chroma.StyleEntries{
		// Background colors (using site's --color-bg-card)
		chroma.Background: "bg:#2d3e51",
		
		// Comments (using --color-text-muted)
		chroma.Comment:                  "#6b7280 italic",
		chroma.CommentHashbang:          "#6b7280 italic",
		chroma.CommentMultiline:         "#6b7280 italic",
		chroma.CommentPreproc:           "#6b7280 italic",
		chroma.CommentSingle:            "#6b7280 italic",
		chroma.CommentSpecial:           "#6b7280 italic bold",
		
		// Keywords (using --color-accent-pink)
		chroma.Keyword:                  "#ff4c8b bold",
		chroma.KeywordConstant:          "#ff4c8b bold",
		chroma.KeywordDeclaration:       "#ff4c8b bold",
		chroma.KeywordNamespace:         "#ff4c8b bold",
		chroma.KeywordPseudo:            "#ff4c8b bold",
		chroma.KeywordReserved:          "#ff4c8b bold",
		chroma.KeywordType:              "#ff4c8b bold",
		
		// Strings (using --color-accent-yellow)
		chroma.String:                   "#ffd93d",
		chroma.StringAffix:              "#ffd93d",
		chroma.StringBacktick:           "#ffd93d",
		chroma.StringChar:               "#ffd93d",
		chroma.StringDelimiter:          "#ffd93d",
		chroma.StringDoc:                "#ffd93d italic",
		chroma.StringDouble:             "#ffd93d",
		chroma.StringEscape:             "#ffd93d bold",
		chroma.StringHeredoc:            "#ffd93d",
		chroma.StringInterpol:           "#ffd93d",
		chroma.StringOther:              "#ffd93d",
		chroma.StringRegex:              "#ffd93d",
		chroma.StringSingle:             "#ffd93d",
		chroma.StringSymbol:             "#ffd93d",
		
		// Names and functions (using --color-accent-blue)
		chroma.Name:                     "#ffffff",
		chroma.NameAttribute:            "#4fc3f7",
		chroma.NameBuiltin:              "#4fc3f7",
		chroma.NameBuiltinPseudo:        "#4fc3f7",
		chroma.NameClass:                "#4fc3f7 bold",
		chroma.NameConstant:             "#4fc3f7",
		chroma.NameDecorator:            "#4fc3f7",
		chroma.NameEntity:               "#4fc3f7",
		chroma.NameException:            "#4fc3f7 bold",
		chroma.NameFunction:             "#4fc3f7 bold",
		chroma.NameFunctionMagic:        "#4fc3f7 bold",
		chroma.NameLabel:                "#4fc3f7",
		chroma.NameNamespace:            "#4fc3f7",
		chroma.NameOther:                "#4fc3f7",
		chroma.NameProperty:             "#4fc3f7",
		chroma.NameTag:                  "#ff4c8b",
		chroma.NameVariable:             "#ffffff",
		chroma.NameVariableClass:        "#ffffff",
		chroma.NameVariableGlobal:       "#ffffff",
		chroma.NameVariableInstance:     "#ffffff",
		chroma.NameVariableMagic:        "#ffffff",
		
		// Numbers (using --color-accent-yellow)
		chroma.Number:                   "#ffd93d",
		chroma.NumberBin:                "#ffd93d",
		chroma.NumberFloat:              "#ffd93d",
		chroma.NumberHex:                "#ffd93d",
		chroma.NumberInteger:            "#ffd93d",
		chroma.NumberIntegerLong:        "#ffd93d",
		chroma.NumberOct:                "#ffd93d",
		
		// Operators (using --color-text-primary)
		chroma.Operator:                 "#ffffff",
		chroma.OperatorWord:             "#ff4c8b bold",
		
		// Punctuation
		chroma.Punctuation:              "#9ca3af",
		
		// Text
		chroma.Text:                     "#ffffff",
		chroma.TextWhitespace:           "",
		
		// Literals
		chroma.Literal:                  "#ffd93d",
		chroma.LiteralDate:              "#ffd93d",
		
		// Generic styles
		chroma.GenericDeleted:           "#ff4c8b",
		chroma.GenericEmph:              "italic",
		chroma.GenericError:             "#ff4c8b bold",
		chroma.GenericHeading:           "#4fc3f7 bold",
		chroma.GenericInserted:          "#4fc3f7",
		chroma.GenericOutput:            "#9ca3af",
		chroma.GenericPrompt:            "#6b7280 bold",
		chroma.GenericStrong:            "bold",
		chroma.GenericSubheading:        "#4fc3f7",
		chroma.GenericTraceback:         "#ff4c8b",
		chroma.GenericUnderline:         "underline",
		
		// Other
		chroma.Other:                    "#ffffff",
		chroma.Error:                    "#ff4c8b bold",
	}))
}()

// GetHighlighting returns a goldmark highlighting extension configured with our custom theme
func GetHighlighting() goldmark.Extender {
	return highlighting.NewHighlighting(
		highlighting.WithStyle("custom-dark"),
		highlighting.WithFormatOptions(
			chromahtml.WithClasses(true), // Use CSS classes instead of inline styles
			chromahtml.TabWidth(4),
			chromahtml.PreventSurroundingPre(false), // Let goldmark handle the pre tags
		),
	)
}

// GenerateCSS generates the CSS for syntax highlighting
func GenerateCSS() (string, error) {
	style := CustomDarkStyle
	if style == nil {
		return "", fmt.Errorf("custom-dark style not found")
	}
	
	formatter := chromahtml.New(chromahtml.WithClasses(true))
	
	var buf bytes.Buffer
	// Write CSS with .chroma prefix for all classes
	buf.WriteString("/* Generated Chroma CSS for syntax highlighting */\n")
	buf.WriteString("/* Custom dark theme matching site colors */\n\n")
	
	// Add container styles
	buf.WriteString(".chroma {\n")
	buf.WriteString("  background-color: var(--color-bg-card);\n")
	buf.WriteString("  color: var(--color-text-primary);\n")
	buf.WriteString("  padding: var(--space-lg);\n")
	buf.WriteString("  border-radius: var(--border-radius-md);\n")
	buf.WriteString("  overflow-x: auto;\n")
	buf.WriteString("  line-height: 1.6;\n")
	buf.WriteString("  font-family: var(--font-family-mono);\n")
	buf.WriteString("  font-size: var(--font-size-sm);\n")
	buf.WriteString("}\n\n")
	
	// Write the style CSS
	if err := formatter.WriteCSS(&buf, style); err != nil {
		return "", err
	}
	
	return buf.String(), nil
}