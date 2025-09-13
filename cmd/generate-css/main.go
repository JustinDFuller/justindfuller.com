// Package main generates the Chroma CSS file for syntax highlighting
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/justindfuller/justindfuller.com/syntax"
)

func main() {
	css, err := syntax.GenerateCSS()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating CSS: %v\n", err)
		os.Exit(1)
	}

	// Create static directory if it doesn't exist
	staticDir := "static"
	if err := os.MkdirAll(staticDir, 0750); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating static directory: %v\n", err)
		os.Exit(1)
	}

	// Write CSS file
	cssPath := filepath.Join(staticDir, "chroma.css")
	if err := os.WriteFile(cssPath, []byte(css), 0600); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing CSS file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully generated %s\n", cssPath)
}