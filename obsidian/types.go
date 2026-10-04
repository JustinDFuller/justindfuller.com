package obsidian

import (
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

type Environment string

const (
	EnvironmentProduction Environment = "production"
	EnvironmentNonprod    Environment = "nonprod"
)

type Mode string

const (
	ModeProduction Mode = "production"
	ModeStaging    Mode = "staging"
	ModePreview    Mode = "preview"
	ModeLocal      Mode = "local"
)

func (m Mode) Valid() bool {
	return m == ModeProduction || m == ModeStaging || m == ModePreview || m == ModeLocal
}

func environmentEligible(environment Environment, mode Mode) bool {
	return mode.Valid() && (environment == EnvironmentProduction || (environment == EnvironmentNonprod && mode != ModeProduction))
}

type RemoteFile struct {
	ID       string
	Name     string
	Path     string
	Revision string
	MimeType string
	MD5      string
	Size     int64
	IsFolder bool
}

type Issue struct {
	Key        string    `json:"key"`
	FileID     string    `json:"file_id,omitempty"`
	Path       string    `json:"path,omitempty"`
	Revision   string    `json:"revision,omitempty"`
	Category   string    `json:"category"`
	Message    string    `json:"message"`
	Reference  string    `json:"reference,omitempty"`
	Route      string    `json:"route,omitempty"`
	Fallback   string    `json:"fallback,omitempty"`
	ObservedAt time.Time `json:"observed_at"`
}

type Asset struct {
	URL string
}

type imageResolveError struct{ category string }

func (e imageResolveError) Error() string { return e.category }

type ImageRecord struct {
	SHA256      string `json:"sha256"`
	MD5         string `json:"md5"`
	Size        int64  `json:"size"`
	ContentType string `json:"contentType"`
	Key         string `json:"key"`
}

type FileRecord struct {
	Key    string `json:"key"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

type SourceSnapshot struct {
	Version int                    `json:"version"`
	Files   map[string]FileRecord  `json:"files"`
	Images  map[string]ImageRecord `json:"images"`
}

type State struct {
	FileImages map[string]map[string]ImageRecord `json:"fileImages"`

	Version  int                    `json:"version"`
	Mode     Mode                   `json:"mode"`
	Revision string                 `json:"revision"`
	Files    map[string][]byte      `json:"files"`
	Images   map[string]ImageRecord `json:"images"`
}

type Prepared struct {
	Version  int                    `json:"version"`
	Mode     Mode                   `json:"mode"`
	Revision string                 `json:"revision"`
	Entries  []programming.Entry    `json:"entries"`
	Masks    []string               `json:"masks"`
	Images   map[string]ImageRecord `json:"images"`
	Issues   []Issue                `json:"issues"`
	State    State                  `json:"state"`
	Digest   string                 `json:"digest"`
}
