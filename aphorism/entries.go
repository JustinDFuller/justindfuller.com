package aphorism

import (
	"bytes"
	"os"

	"github.com/pkg/errors"
)

func Entries() ([][]byte, error) {
	file, err := os.ReadFile("./aphorism/entries.txt")
	if err != nil {
		return nil, errors.Wrap(err, "error reading aphorisms entries.txt")
	}

	split := bytes.Split(file, []byte("\n"))
	for i := len(split) - 1; i >= 0; i-- {
		split[i] = bytes.TrimSpace(split[i])
		if split[i] == nil {
			split = append(split[:i], split[i+1:]...)
		}
	}

	low := 0
	high := len(split) - 1
	for high > low {
		split[low], split[high] = split[high], split[low]
		low++
		high--
	}

	return split, nil
}
