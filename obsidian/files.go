package obsidian

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func LoadPrepared(filename string, mode Mode) (Prepared, error) {
	var prepared Prepared
	root, err := os.OpenRoot(filepath.Dir(filename))
	if err != nil {
		return prepared, err
	}
	defer func() { _ = root.Close() }()
	body, err := root.ReadFile(filepath.Base(filename))
	if err != nil {
		return prepared, err
	}
	if err := DecodeStrict(body, &prepared); err != nil {
		return prepared, err
	}
	return prepared, ValidatePrepared(prepared, mode)
}

func WritePrivateJSON(filename string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(filename), 0o700); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(filename), ".pending-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer func() { _ = os.Remove(name) }()
	if _, err := file.Write(body); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(name, filename)
}
