package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/obsidian"
)

const defaultAccount = "9dce34804a27754a4ea66a5789827dfa"
const defaultBucket = "justindfuller-obsidian-source"

type sourceReadError struct{}

func (sourceReadError) Error() string { return "Private source is unavailable" }

func privatePath(filename string) (string, error) {
	if strings.TrimSpace(filename) == "" {
		return "", errors.New("private path required")
	}
	root, err := filepath.Abs(".obsidian-publish")
	if err != nil {
		return "", err
	}
	file, err := filepath.Abs(filename)
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(root, file)
	if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", errors.New("private path must be below .obsidian-publish")
	}
	current := root
	for _, part := range append([]string{root}, strings.Split(relative, string(filepath.Separator))...) {
		if part != root {
			current = filepath.Join(current, part)
		}
		info, statErr := os.Lstat(current)
		if statErr != nil {
			if errors.Is(statErr, os.ErrNotExist) {
				continue
			}
			return "", statErr
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New("linked private path denied")
		}
	}
	return file, nil
}

func pinSource(ctx context.Context, reader obsidian.ObjectReader, previous obsidian.State, output string) (obsidian.LoadedSource, error) {
	var empty obsidian.LoadedSource
	file, err := privatePath(output)
	if err != nil {
		return empty, err
	}
	source, err := obsidian.ReadSource(ctx, reader)
	if err != nil {
		return empty, sourceReadError{}
	}
	obsidian.VerifyStateImages(ctx, reader, &source, previous)
	if err := obsidian.WritePrivateJSON(file, source); err != nil {
		return empty, err
	}
	return source, nil
}

func run(arguments []string, environment func(string) string) error {
	flags := flag.NewFlagSet("pin-obsidian-source", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	account := flags.String("account", defaultAccount, "Cloudflare account ID")
	bucket := flags.String("bucket", defaultBucket, "Private source bucket")
	output := flags.String("out", "", "Private pinned source output")
	statePath := flags.String("state", "", "Optional private accepted state")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 0 || *output == "" {
		return errors.New("explicit private source output required")
	}
	var state obsidian.State
	if *statePath != "" {
		file, err := privatePath(*statePath)
		if err != nil {
			return err
		}
		body, err := os.ReadFile(filepath.Clean(file))
		if err != nil {
			return err
		}
		if err := obsidian.DecodeStrict(body, &state); err != nil {
			return err
		}
	}
	reader, err := obsidian.NewR2Reader(*account, *bucket, environment("OBSIDIAN_SOURCE_ACCESS_KEY_ID"), environment("OBSIDIAN_SOURCE_SECRET_ACCESS_KEY"))
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	source, err := pinSource(ctx, reader, state, *output)
	if err != nil {
		return err
	}
	fmt.Printf("Pinned source revision=%s files=%d images=%d\n", source.Revision, len(source.Bodies), len(source.Snapshot.Images))
	return nil
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	var sourceFailure sourceReadError
	if errors.As(err, &sourceFailure) {
		return 10
	}
	return 1
}

func main() {
	err := run(os.Args[1:], os.Getenv)
	code := exitCode(err)
	if code == 0 {
		return
	}
	fmt.Fprintln(os.Stderr, "Private source pin failed; inspect private inputs and source credentials")
	os.Exit(code)
}
