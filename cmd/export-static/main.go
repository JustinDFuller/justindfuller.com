package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/justindfuller/justindfuller.com/obsidian"
	"github.com/justindfuller/justindfuller.com/site"
)

func main() {
	output := flag.String("out", "dist", "Output directory (must not exist)")
	manifestPath := flag.String("manifest", ".cloudflare/site-manifest.json", "Validation manifest outside public assets")
	mode := flag.String("mode", "preview", "Build mode: production, preview, staging, local")
	overlay := flag.String("overlay", "", "Private prepared Obsidian overlay")
	flag.Parse()
	if *overlay != "" {
		log.SetOutput(io.Discard)
	}
	if !obsidian.Mode(*mode).Valid() {
		log.Fatal("Invalid build mode")
	}
	var prepared *obsidian.Prepared
	if *overlay != "" {
		loaded, err := obsidian.LoadPrepared(*overlay, obsidian.Mode(*mode))
		if err != nil {
			fmt.Fprintln(os.Stderr, "Invalid private overlay")
			os.Exit(1)
		}
		prepared = &loaded
	}
	manifest, err := site.ExportWithPrepared(*output, *mode == "production", prepared)
	if err != nil {
		if *overlay != "" {
			fmt.Fprintln(os.Stderr, "Private content export failed")
			os.Exit(1)
		}
		log.Fatal(err)
	}
	if err := site.WriteManifest(manifest, *manifestPath); err != nil {
		fmt.Fprintln(os.Stderr, "Export manifest write failed")
		os.Exit(1)
	}
	fmt.Printf("Exported %d pages and %d assets to %s\n", len(manifest.Pages), len(manifest.Assets), *output)
}
