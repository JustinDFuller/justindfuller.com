package poem

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

func Entries() ([][]byte, error) {
	files, err := os.ReadDir("./poem")
	if err != nil {
		return nil, errors.Wrap(err, "error reading poetry entries")
	}

	names := make([]string, 0, len(files))

	for _, dir := range files {
		name := dir.Name()

		// skip non-markdown files
		if !strings.HasSuffix(name, ".md") {
			log.Printf("Skipping %s because it does not end with .md", name)

			continue
		}

		// skip sub-dirs
		if dir.IsDir() {
			log.Printf("Skipping %s because it is a directory", dir.Name())

			continue
		}

		split := strings.Split(name, ".")

		if len(split) != 2 { //nolint:mnd
			log.Printf("Skipping %s because it was not split in two.", name)

			continue
		}

		fileName := split[0]

		// skip any files that are not numeric
		if _, err := strconv.Atoi(fileName); err != nil {
			fmt.Printf("Skipping %s because it is not a number.", name)

			continue
		}

		names = append(names, name)
	}

	sort.Slice(names, func(i, j int) bool {
		s1 := strings.Split(names[i], ".")[0]
		s2 := strings.Split(names[j], ".")[0]

		n1, err := strconv.Atoi(s1)
		if err != nil {
			log.Fatalf("Error parsing string to int: %s", err)
		}

		n2, err := strconv.Atoi(s2)
		if err != nil {
			log.Fatalf("Error parsing string to int: %s", err)
		}

		return n2 > n1
	})

	contents := make([][]byte, len(names))
	var wg errgroup.Group

	for i, name := range names {
		wg.Go(func() error {
			path := fmt.Sprintf("./poem/%s", name)

			file, err := os.ReadFile(path)
			if err != nil {
				return errors.Wrapf(err, "error reading file: %s", path)
			}

			content := file
			content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
			content = bytes.Split(content, []byte("```"))[1]
			contents[i] = content

			return nil
		})
	}

	if err := wg.Wait(); err != nil {
		return nil, errors.Wrap(err, "Error reading poems")
	}

	low := 0
	high := len(contents) - 1

	for high > low {
		contents[low], contents[high] = contents[high], contents[low]
		low++
		high--
	}

	return contents, nil
}

func Entry(name string) ([][]byte, error) {
	path := fmt.Sprintf("./poem/%s.md", name)

	file, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrapf(err, "error reading file: %s", path)
	}

	content := file
	content = bytes.Replace(content, []byte("```text"), []byte("```"), 1)
	content = bytes.Split(content, []byte("```"))[1]

	return [][]byte{content}, nil
}
