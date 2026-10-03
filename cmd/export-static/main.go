package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/justindfuller/justindfuller.com/site"
)

func main() {
	output := flag.String("out", "dist", "Output directory (must not exist)")
	manifestPath := flag.String("manifest", ".cloudflare/site-manifest.json", "Validation manifest outside public assets")
	mode := flag.String("mode", "preview", "Build mode: production or preview")
	flag.Parse()
	if *mode != "production" && *mode != "preview" {
		log.Fatal("Build mode must be production or preview")
	}
	manifest, err := site.Export(*output, *mode == "production")
	if err != nil {
		log.Fatal(err)
	}
	if err := site.WriteManifest(manifest, *manifestPath); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Exported %d pages and %d assets to %s\n", len(manifest.Pages), len(manifest.Assets), *output)
}
