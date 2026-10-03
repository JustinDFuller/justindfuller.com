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
	flag.Parse()
	manifest, err := site.Export(*output)
	if err != nil {
		log.Fatal(err)
	}
	if err := site.WriteManifest(manifest, *manifestPath); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Exported %d pages and %d assets to %s\n", len(manifest.Pages), len(manifest.Assets), *output)
}
