package story

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/pkg/errors"
)

func Entry(want string) ([]byte, error) {
	files, err := os.ReadDir("./story")
	if err != nil {
		return nil, errors.Wrap(err, "error reading story directory")
	}

	var name string

	for _, dir := range files {
		if n := dir.Name(); strings.HasSuffix(n, fmt.Sprintf("%s.md", want)) {
			name = n
		}
	}

	if name == "" {
		return nil, errors.New("not found")
	}

	path := fmt.Sprintf("./story/%s", name)

	file, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrapf(err, "error reading story: %s", path)
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

	return bytes.Join(lines, nil), nil
}
