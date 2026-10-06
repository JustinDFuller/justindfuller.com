package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/justindfuller/justindfuller.com/obsidian"
	"github.com/justindfuller/justindfuller.com/site"
)

func run() error {
	sourcePath := flag.String("source", "", "Private pinned source input")
	statePath := flag.String("state", "", "Private accepted state input")
	output := flag.String("out", ".obsidian-publish/prepared.json", "Private prepared output")
	loadedOutput := flag.String("source-out", "", "Optional pinned private loaded source output")
	reportOutput := flag.String("report-out", "", "Optional protected preparation diagnostics without post bodies")
	validateOverlay := flag.String("validate-promotion", "", "Validate a production overlay before public image promotion")
	acceptedOnly := flag.Bool("accepted-only", false, "Explicit revalidated accepted-state fallback for source outages")
	unavailablePath := flag.String("unavailable-images", "", "Optional private unavailable image key array")
	mode := flag.String("mode", "local", "Deployment mode: production, staging, preview, local")
	bootstrap := flag.Bool("bootstrap", false, "Explicit initial state bootstrap")
	r2 := flag.Bool("r2", false, "Read a pinned private R2 source with environment credentials")
	account := flag.String("account", "9dce34804a27754a4ea66a5789827dfa", "Cloudflare account ID")
	bucket := flag.String("bucket", "justindfuller-obsidian-source", "Private source bucket")
	flag.Parse()
	if *validateOverlay != "" {
		prepared, err := obsidian.LoadPrepared(*validateOverlay, obsidian.ModeProduction)
		if err != nil {
			return err
		}
		entries, err := site.LoadProgramming()
		if err != nil {
			return err
		}
		if err := obsidian.ValidateImagePromotion(prepared, entries); err != nil {
			return err
		}
		fmt.Printf("Verified production image authorization: %d images\n", len(prepared.Images))
		return nil
	}
	var source obsidian.LoadedSource
	var state obsidian.State
	if *statePath != "" {
		body, err := os.ReadFile(*statePath)
		if err != nil {
			return err
		}
		if err := obsidian.DecodeStrict(body, &state); err != nil {
			return err
		}
	} else if !*bootstrap {
		return fmt.Errorf("explicit bootstrap or accepted state required")
	}
	if *acceptedOnly {
		if *r2 || *sourcePath != "" || *loadedOutput != "" || *bootstrap {
			return fmt.Errorf("accepted-state fallback must not use source or bootstrap options")
		}
		unavailable := map[string]bool{}
		if *unavailablePath != "" {
			body, err := os.ReadFile(*unavailablePath)
			if err != nil {
				return err
			}
			var keys []string
			if err := obsidian.DecodeStrict(body, &keys); err != nil {
				return err
			}
			for _, key := range keys {
				unavailable[key] = true
			}
		}
		entries, err := site.LoadProgramming()
		if err != nil {
			return err
		}
		prepared, err := obsidian.PrepareAccepted(state, entries, obsidian.Mode(*mode), unavailable, time.Now().UTC())
		if err != nil {
			return err
		}
		if err := obsidian.WritePrivateJSON(*output, prepared); err != nil {
			return err
		}
		if err := writeReport(*reportOutput, prepared); err != nil {
			return err
		}
		fmt.Printf("Prepared degraded mode=%s revision=%s digest=%s posts=%d issues=%d\n", prepared.Mode, prepared.Revision, prepared.Digest, len(prepared.Entries), len(prepared.Issues))
		return nil
	}
	if *unavailablePath != "" {
		return fmt.Errorf("unavailable image override requires accepted-state fallback")
	}
	if *r2 {
		if *sourcePath != "" {
			return fmt.Errorf("choose one source input")
		}
		reader, err := obsidian.NewR2Reader(*account, *bucket, os.Getenv("OBSIDIAN_SOURCE_ACCESS_KEY_ID"), os.Getenv("OBSIDIAN_SOURCE_SECRET_ACCESS_KEY"))
		if err != nil {
			return err
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		source, err = obsidian.ReadSource(ctx, reader)
		if err != nil {
			return err
		}
		obsidian.VerifyStateImages(ctx, reader, &source, state)
	} else {
		body, err := os.ReadFile(*sourcePath)
		if err != nil {
			return err
		}
		if err := obsidian.DecodeStrict(body, &source); err != nil {
			return err
		}
	}
	entries, err := site.LoadProgramming()
	if err != nil {
		return err
	}
	prepared, err := obsidian.Prepare(source, state, entries, obsidian.Mode(*mode), time.Now().UTC())
	if err != nil {
		return err
	}
	if err := obsidian.WritePrivateJSON(*output, prepared); err != nil {
		return err
	}
	if err := writeReport(*reportOutput, prepared); err != nil {
		return err
	}
	if *loadedOutput != "" {
		if err := obsidian.WritePrivateJSON(*loadedOutput, source); err != nil {
			return err
		}
	}
	fmt.Printf("Prepared mode=%s revision=%s digest=%s posts=%d issues=%d\n", prepared.Mode, prepared.Revision, prepared.Digest, len(prepared.Entries), len(prepared.Issues))
	return nil
}

func writeReport(destination string, prepared obsidian.Prepared) error {
	if destination == "" {
		return nil
	}
	report, err := obsidian.ReportPrepared(prepared)
	if err != nil {
		return err
	}
	return obsidian.WritePrivateJSON(destination, report)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Content preparation failed; inspect the private input and accepted state")
		os.Exit(1)
	}
}
