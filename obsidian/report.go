package obsidian

import (
	"errors"
	"sort"
)

type ReportFile struct {
	Path        string      `json:"path"`
	Revision    string      `json:"revision"`
	Slug        string      `json:"slug"`
	Environment Environment `json:"environment"`
	Sync        string      `json:"sync"`
	Draft       bool        `json:"draft"`
}

type PreparationReport struct {
	Version int          `json:"version"`
	Mode    Mode         `json:"mode"`
	Source  string       `json:"source"`
	Digest  string       `json:"digest"`
	Files   []ReportFile `json:"files"`
	Masks   []string     `json:"masks"`
	Issues  []Issue      `json:"issues"`
}

func ReportPrepared(prepared Prepared) (PreparationReport, error) {
	if err := ValidatePrepared(prepared, prepared.Mode); err != nil {
		return PreparationReport{}, err
	}
	report := PreparationReport{Version: 1, Mode: prepared.Mode, Source: prepared.Revision, Digest: prepared.Digest, Files: []ReportFile{}, Masks: prepared.Masks, Issues: prepared.Issues}
	for name, raw := range prepared.State.Files {
		front, _, err := splitFrontMatter(string(raw))
		if err != nil {
			return PreparationReport{}, err
		}
		metadata, err := parseMetadata(front)
		if err != nil || !environmentEligible(metadata.Environment, prepared.Mode) {
			return PreparationReport{}, errors.New("report ownership cannot be validated")
		}
		report.Files = append(report.Files, ReportFile{Path: name, Revision: SHA256(raw), Slug: metadata.Slug, Environment: metadata.Environment, Sync: metadata.Sync, Draft: metadata.Draft})
	}
	sort.Slice(report.Files, func(i, j int) bool { return report.Files[i].Path < report.Files[j].Path })
	return report, nil
}
