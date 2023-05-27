package story

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

func Entries() ([][]byte, error) {
	files, err := os.ReadDir("./story")
	if err != nil {
		return nil, errors.Wrap(err, "error reading story directory")
	}

	var names []string
	for _, dir := range files {
		if name := dir.Name(); strings.HasSuffix(name, ".md") && !dir.IsDir() {
			names = append(names, name)
		}
	}

	contents := make([][]byte, len(names), len(names))
	var wg errgroup.Group

	for i, name := range names {
		i := i
		name := name

		wg.Go(func() error {
			path := fmt.Sprintf("./story/%s", name)

			file, err := os.ReadFile(path)
			if err != nil {
				return errors.Wrapf(err, "error reading story: %s", path)
			}

			lines := bytes.Split(file, []byte("\n"))

			for i := len(lines) - 1; i >= 0; i-- {
				lines[i] = bytes.TrimSpace(lines[i])
				if lines[i] == nil || bytes.Equal(lines[i], []byte("\n")) {
					lines = append(lines[:i], lines[i+1:]...)
				}
			}

			for i, line := range lines {
				if bytes.HasPrefix(line, []byte("<h")) {
					continue
				}

				if line == nil || bytes.Equal(line, []byte("\n")) {
					continue
				}

				lines[i] = append([]byte("<p>"), line...)
				lines[i] = append(lines[i], []byte("</p>")...)
			}

			contents[i] = bytes.Join(lines, nil)

			return nil
		})
	}

	if err := wg.Wait(); err != nil {
		return nil, errors.Wrap(err, "error reading stories")
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
