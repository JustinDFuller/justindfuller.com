package obsidian

import (
	"context"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
)

type Environment string

const (
	EnvironmentProduction Environment = "prd"
	EnvironmentPreview    Environment = "pr"
	EnvironmentLocal      Environment = "local"
)

type Config struct {
	FolderID                   string
	GCSBucket                  string
	GCSPrefix                  string
	MediaBaseURL               string
	Environment                Environment
	SyncInterval               time.Duration
	SyncTimeout                time.Duration
	DiagnosticsToken           string
	SiteURL                    string
	GoogleOAuthKeychainService string
	GoogleOAuthKeychainAccount string
	KeychainReader             KeychainReader
	SourceFactory              func(context.Context) (Source, error)
	ImageResolver              func(RemoteFile) (Asset, error)
	EventLogger                func(Event)
	NotificationLogger         func(Issue)
	Now                        func() time.Time
}

type KeychainReader func(context.Context, string, string) (string, error)

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

type SourceTree struct {
	Files []RemoteFile
}

type Source interface {
	Read(context.Context, string) (SourceTree, error)
	Download(context.Context, string) ([]byte, error)
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

type Event struct {
	Name       string    `json:"event"`
	Severity   string    `json:"severity"`
	Category   string    `json:"category,omitempty"`
	FileID     string    `json:"file_id,omitempty"`
	Path       string    `json:"path,omitempty"`
	Revision   string    `json:"revision,omitempty"`
	Reference  string    `json:"reference,omitempty"`
	Route      string    `json:"route,omitempty"`
	Fallback   string    `json:"fallback,omitempty"`
	Message    string    `json:"message,omitempty"`
	ObservedAt time.Time `json:"observed_at"`
}

type Asset struct {
	Token       string `json:"token"`
	FileID      string `json:"file_id"`
	Path        string `json:"path"`
	Revision    string `json:"revision"`
	ContentType string `json:"content_type"`
	URL         string `json:"url"`
}

type Provenance struct {
	Source string `json:"source"`
	Mode   string `json:"mode,omitempty"`
}

type Status struct {
	State       string    `json:"state"`
	Stale       bool      `json:"stale"`
	LastAttempt time.Time `json:"last_attempt"`
	LastSuccess time.Time `json:"last_success,omitempty"`
	Message     string    `json:"message,omitempty"`
}

type Diagnostics struct {
	Status Status            `json:"status"`
	Issues []Issue           `json:"issues"`
	Routes []DiagnosticRoute `json:"routes"`
	Files  []DiagnosticFile  `json:"files"`
}

type DiagnosticRoute struct {
	Slug       string     `json:"slug"`
	Provenance Provenance `json:"provenance"`
	Draft      bool       `json:"draft"`
	Masked     bool       `json:"masked"`
}

type DiagnosticFile struct {
	FileID   string `json:"file_id"`
	Path     string `json:"path"`
	Revision string `json:"revision"`
	State    string `json:"state"`
	Route    string `json:"route,omitempty"`
	Mode     string `json:"mode,omitempty"`
}

type RouteResolution struct {
	Entry      programming.Entry
	Found      bool
	Masked     bool
	Provenance Provenance
}
