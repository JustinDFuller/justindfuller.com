package obsidian

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/justindfuller/justindfuller.com/programming"
	"google.golang.org/api/googleapi"
)

const defaultSyncInterval = 30 * time.Second
const productionSyncTimeout = 30 * time.Second
const unrecoverableRetryInterval = 5 * time.Minute

var errInvalidSourceConfiguration = errors.New("invalid Obsidian source configuration")

type snapshot struct {
	Candidates map[string]candidate
	Routes     map[string]candidate
	Masked     map[string]candidate
	Images     map[string]Asset
	Files      []DiagnosticFile
}

type Store struct {
	config        Config
	mu            sync.Mutex
	source        Source
	sourceError   error
	nextSourceTry time.Time
	nextSyncTry   time.Time
	lastAttempt   time.Time
	lastSuccess   time.Time
	lastGood      map[string]candidate
	activeIssues  map[string]Issue
	current       snapshot
	initialized   bool
	statusMessage string
	statusState   string
	statusStale   bool
	syncing       bool
}

func ConfigFromEnv() Config {
	environmentValue := os.Getenv("OBSIDIAN_ENVIRONMENT")
	environment := Environment(environmentValue)
	if environmentValue == "" {
		environment = inferredEnvironment()
	}

	return Config{
		FolderID:                   os.Getenv("OBSIDIAN_DRIVE_FOLDER_ID"),
		Environment:                environment,
		SyncInterval:               defaultSyncInterval,
		DiagnosticsToken:           os.Getenv("OBSIDIAN_DIAGNOSTICS_TOKEN"),
		SiteURL:                    "https://justindfuller.com",
		GoogleOAuthKeychainService: os.Getenv("OBSIDIAN_GOOGLE_OAUTH_KEYCHAIN_SERVICE"),
		GoogleOAuthKeychainAccount: os.Getenv("OBSIDIAN_GOOGLE_OAUTH_KEYCHAIN_ACCOUNT"),
	}
}

func inferredEnvironment() Environment {
	service := os.Getenv("GAE_SERVICE")
	switch {
	case service == "default":
		return EnvironmentProduction
	case strings.HasPrefix(service, "pr-"):
		return EnvironmentPreview
	default:
		return EnvironmentLocal
	}
}

func NewStore(config Config) *Store {
	if config.Environment == "" {
		config.Environment = EnvironmentLocal
	}
	if config.SyncInterval <= 0 {
		config.SyncInterval = defaultSyncInterval
	}
	if config.SiteURL == "" {
		config.SiteURL = "https://justindfuller.com"
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.KeychainReader == nil {
		config.KeychainReader = readKeychainSecret
	}
	if config.SourceFactory == nil {
		sourceConfig := config
		config.SourceFactory = func(ctx context.Context) (Source, error) {
			return newDriveSource(ctx, sourceConfig)
		}
	}
	if config.EventLogger == nil {
		config.EventLogger = defaultEventLogger
	}
	if config.NotificationLogger == nil {
		config.NotificationLogger = func(issue Issue) {
			config.EventLogger(Event{
				Name:       "sync_notification",
				Severity:   "ERROR",
				Category:   issue.Category,
				FileID:     issue.FileID,
				Path:       issue.Path,
				Revision:   issue.Revision,
				Reference:  issue.Reference,
				Route:      issue.Route,
				Fallback:   issue.Fallback,
				Message:    issue.Message,
				ObservedAt: issue.ObservedAt,
			})
		}
	}

	return &Store{
		config:       config,
		lastGood:     make(map[string]candidate),
		activeIssues: make(map[string]Issue),
		current: snapshot{
			Candidates: make(map[string]candidate),
			Routes:     make(map[string]candidate),
			Masked:     make(map[string]candidate),
			Images:     make(map[string]Asset),
		},
		statusState: "uninitialized",
	}
}

func defaultEventLogger(event Event) {
	encoded, err := json.Marshal(event)
	if err != nil {
		log.Printf("obsidian_sync event=serialization_error")
		return
	}
	log.Printf("obsidian_sync %s", encoded)
}

func (s *Store) Entries(ctx context.Context, local []programming.Entry) []programming.Entry {
	localRoutes := make(map[string]int, len(local))
	for _, entry := range local {
		localRoutes[entry.Slug]++
	}
	s.ensureSynced(ctx, localRoutes)

	s.mu.Lock()
	defer s.mu.Unlock()

	entries := append([]programming.Entry(nil), local...)
	positions := make(map[string]int, len(entries))
	for index, entry := range entries {
		positions[entry.Slug] = index
	}

	for slug, candidate := range s.current.Routes {
		if candidate.Entry.IsDraft {
			if candidate.Mode == "overwrite" {
				if index, ok := positions[slug]; ok {
					entries = append(entries[:index], entries[index+1:]...)
					positions = positionsAfterRemoval(entries)
				}
			}
			continue
		}

		if candidate.Mode == "overwrite" {
			if index, ok := positions[slug]; ok {
				entries[index] = candidate.Entry
			}
			continue
		}

		if _, ok := positions[slug]; !ok {
			positions[slug] = len(entries)
			entries = append(entries, candidate.Entry)
		}
	}
	for slug, candidate := range s.current.Masked {
		if candidate.Mode != "overwrite" {
			continue
		}
		if index, ok := positions[slug]; ok {
			entries = append(entries[:index], entries[index+1:]...)
			positions = positionsAfterRemoval(entries)
		}
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})
	return entries
}

func positionsAfterRemoval(entries []programming.Entry) map[string]int {
	positions := make(map[string]int, len(entries))
	for index, entry := range entries {
		positions[entry.Slug] = index
	}
	return positions
}

func (s *Store) Resolve(ctx context.Context, slug string, local []programming.Entry, loadLocal func() (programming.Entry, error)) RouteResolution {
	localRoutes := make(map[string]int, len(local))
	for _, entry := range local {
		localRoutes[entry.Slug]++
	}
	s.ensureSynced(ctx, localRoutes)

	s.mu.Lock()
	defer s.mu.Unlock()

	if candidate, ok := s.current.Routes[slug]; ok {
		if candidate.Entry.IsDraft {
			return RouteResolution{Masked: true, Provenance: Provenance{Source: "obsidian", Mode: candidate.Mode}}
		}
		return RouteResolution{
			Entry:      candidate.Entry,
			Found:      true,
			Provenance: Provenance{Source: "obsidian", Mode: candidate.Mode},
		}
	}
	if candidate, ok := s.current.Masked[slug]; ok {
		return RouteResolution{Masked: true, Provenance: Provenance{Source: "obsidian", Mode: candidate.Mode}}
	}

	entry, err := loadLocal()
	if err != nil || entry.IsDraft {
		return RouteResolution{}
	}
	return RouteResolution{
		Entry:      entry,
		Found:      true,
		Provenance: Provenance{Source: "local"},
	}
}

func (s *Store) Image(ctx context.Context, token string, local []programming.Entry) (Asset, bool) {
	s.ensureSynced(ctx, routeCounts(local))

	s.mu.Lock()
	defer s.mu.Unlock()
	asset, ok := s.current.Images[token]
	return asset, ok
}

func (s *Store) Diagnostics(ctx context.Context, local []programming.Entry) Diagnostics {
	localRoutes := routeCounts(local)
	s.ensureSynced(ctx, localRoutes)

	s.mu.Lock()
	defer s.mu.Unlock()

	routes := make(map[string]DiagnosticRoute, len(localRoutes)+len(s.current.Routes))
	for slug := range localRoutes {
		routes[slug] = DiagnosticRoute{
			Slug:       slug,
			Provenance: Provenance{Source: "local"},
		}
	}
	for slug, candidate := range s.current.Routes {
		routes[slug] = DiagnosticRoute{
			Slug:       slug,
			Provenance: Provenance{Source: "obsidian", Mode: candidate.Mode},
			Draft:      candidate.Entry.IsDraft,
		}
	}
	for slug, candidate := range s.current.Masked {
		routes[slug] = DiagnosticRoute{
			Slug:       slug,
			Provenance: Provenance{Source: "obsidian", Mode: candidate.Mode},
			Draft:      true,
			Masked:     true,
		}
	}

	routeList := make([]DiagnosticRoute, 0, len(routes))
	for _, route := range routes {
		routeList = append(routeList, route)
	}
	sort.Slice(routeList, func(i, j int) bool { return routeList[i].Slug < routeList[j].Slug })

	issues := make([]Issue, 0, len(s.activeIssues))
	for _, issue := range s.activeIssues {
		issues = append(issues, issue)
	}
	sortIssues(issues)

	files := append([]DiagnosticFile(nil), s.current.Files...)
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })

	return Diagnostics{
		Status: Status{
			State:       s.statusState,
			Stale:       s.statusStale,
			LastAttempt: s.lastAttempt,
			LastSuccess: s.lastSuccess,
			Message:     s.statusMessage,
		},
		Issues: issues,
		Routes: routeList,
		Files:  files,
	}
}

func routeCounts(entries []programming.Entry) map[string]int {
	routes := make(map[string]int, len(entries))
	for _, entry := range entries {
		routes[entry.Slug]++
	}
	return routes
}

func (s *Store) ensureSynced(ctx context.Context, localRoutes map[string]int) {
	now := s.config.Now()
	s.mu.Lock()
	if s.syncing || now.Before(s.nextSyncTry) || (!s.lastAttempt.IsZero() && now.Before(s.lastAttempt.Add(s.config.SyncInterval))) {
		s.mu.Unlock()
		return
	}
	s.lastAttempt = now
	s.syncing = true
	s.mu.Unlock()

	if s.config.Environment == EnvironmentProduction {
		go func() {
			backgroundContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), productionSyncTimeout)
			defer cancel()
			s.synchronize(backgroundContext, localRoutes, now)
		}()
		return
	}
	s.synchronize(ctx, localRoutes, now)
}

func (s *Store) synchronize(ctx context.Context, localRoutes map[string]int, now time.Time) {
	defer func() {
		s.mu.Lock()
		s.syncing = false
		s.mu.Unlock()
	}()
	s.mu.Lock()
	source, err := s.sourceFor(ctx, now)
	s.mu.Unlock()
	if err != nil {
		s.sourceFailure(err, now)
		return
	}

	tree, err := source.Read(ctx, s.config.FolderID)
	if err != nil {
		s.sourceFailure(err, now)
		return
	}

	files := append([]RemoteFile(nil), tree.Files...)
	sort.Slice(files, func(i, j int) bool {
		if files[i].Path == files[j].Path {
			return files[i].ID < files[j].ID
		}
		return files[i].Path < files[j].Path
	})

	index := buildAssetIndex(files)
	current := make(map[string]candidate)
	issues := make(map[string]Issue)
	diagnostics := make([]DiagnosticFile, 0)
	sourceFileIDs := make(map[string]bool, len(files))
	for _, file := range files {
		sourceFileIDs[file.ID] = true
	}

	for _, file := range files {
		if file.IsFolder {
			if file.Path != "image" && !strings.HasPrefix(file.Path, "image/") {
				issue := fileIssue(file, "source_layout", "only the root image directory and its descendants are supported", now)
				s.recordFileIssue(issue, file, current, issues)
			}
			continue
		}

		isRootMarkdown := !strings.Contains(file.Path, "/") && strings.HasSuffix(file.Path, ".md")
		isImage := strings.HasPrefix(file.Path, "image/") && isSupportedImage(file.Path)
		if isImage {
			continue
		}
		if !isRootMarkdown {
			issue := fileIssue(file, "source_layout", "only root Markdown files and supported images below image/ are allowed", now)
			s.recordFileIssue(issue, file, current, issues)
			continue
		}

		raw, err := source.Download(ctx, file.ID)
		if err != nil {
			issue := fileIssue(file, "markdown_download", "Markdown file could not be read", now)
			issues[issue.Key] = issue
			if previous, ok := s.lastGood[file.ID]; ok {
				current[file.ID] = previous
				issue.Route = previous.Entry.Slug
				issue.Fallback = "last_known_good_external"
				issues[issue.Key] = issue
			}
			continue
		}

		parsed, fileIssues := validateMarkdown(file, raw, index, func(fileID string) ([]byte, error) {
			return source.Download(ctx, fileID)
		}, now)
		for _, issue := range fileIssues {
			issues[issue.Key] = issue
		}

		if parsed.File.ID == "" {
			if previous, ok := s.lastGood[file.ID]; ok {
				current[file.ID] = previous
				for key, issue := range issues {
					if issue.FileID == file.ID {
						issue.Route = previous.Entry.Slug
						issue.Fallback = "last_known_good_external"
						issues[key] = issue
					}
				}
			}
			continue
		}

		if !environmentEligible(parsed.Environment, s.config.Environment) {
			s.emit(Event{
				Name:       "sync_file_ignored",
				Severity:   "INFO",
				Category:   "environment_ineligible",
				FileID:     file.ID,
				Path:       file.Path,
				Revision:   file.Revision,
				Route:      parsed.Entry.Slug,
				Message:    "file is not eligible for the active environment",
				ObservedAt: now,
			})
			diagnostics = append(diagnostics, DiagnosticFile{
				FileID:   file.ID,
				Path:     file.Path,
				Revision: file.Revision,
				State:    "ignored",
				Route:    parsed.Entry.Slug,
				Mode:     parsed.Mode,
			})
			continue
		}

		current[file.ID] = parsed
		diagnostics = append(diagnostics, DiagnosticFile{
			FileID:   file.ID,
			Path:     file.Path,
			Revision: file.Revision,
			State:    "valid",
			Route:    parsed.Entry.Slug,
			Mode:     parsed.Mode,
		})
	}

	for fileID := range s.lastGood {
		if !sourceFileIDs[fileID] {
			delete(s.lastGood, fileID)
		}
	}

	active, masked := applyPublicationPolicy(current, localRoutes, s.lastGood, &issues, now)
	allCandidates := make(map[string]candidate, len(active)+len(masked))
	for fileID, parsed := range active {
		allCandidates[fileID] = parsed
	}
	for fileID, parsed := range masked {
		allCandidates[fileID] = parsed
	}
	images := make(map[string]Asset)
	for _, parsed := range active {
		for token, asset := range parsed.Assets {
			images[token] = asset
		}
	}
	for fileID, parsed := range allCandidates {
		s.lastGood[fileID] = parsed
	}
	fallbackIDs := make(map[string]bool)
	for _, issue := range issues {
		if issue.Fallback == "last_known_good_external" {
			fallbackIDs[issue.FileID] = true
		}
	}
	if len(fallbackIDs) > 0 {
		filteredDiagnostics := diagnostics[:0]
		for _, diagnostic := range diagnostics {
			if !fallbackIDs[diagnostic.FileID] {
				filteredDiagnostics = append(filteredDiagnostics, diagnostic)
			}
		}
		diagnostics = filteredDiagnostics
	}

	filesForDiagnostics := diagnostics
	for _, file := range files {
		if file.IsFolder || !strings.HasSuffix(file.Path, ".md") || strings.Contains(file.Path, "/") {
			continue
		}
		found := false
		for _, diagnostic := range filesForDiagnostics {
			if diagnostic.FileID == file.ID {
				found = true
				break
			}
		}
		if found {
			continue
		}
		state := "invalid"
		if previous, ok := s.lastGood[file.ID]; ok {
			state = "last-known-good"
			filesForDiagnostics = append(filesForDiagnostics, DiagnosticFile{
				FileID:   file.ID,
				Path:     file.Path,
				Revision: file.Revision,
				State:    state,
				Route:    previous.Entry.Slug,
				Mode:     previous.Mode,
			})
			continue
		}
		filesForDiagnostics = append(filesForDiagnostics, DiagnosticFile{
			FileID:   file.ID,
			Path:     file.Path,
			Revision: file.Revision,
			State:    state,
		})
	}

	s.mu.Lock()
	s.emitReconciliationEventsLocked(allCandidates, sourceFileIDs, now)
	s.current = snapshot{Candidates: allCandidates, Routes: make(map[string]candidate), Masked: masked, Images: images, Files: filesForDiagnostics}
	for _, parsed := range active {
		s.current.Routes[parsed.Entry.Slug] = parsed
	}
	s.initialized = true
	s.lastSuccess = now
	s.statusStale = false
	s.statusMessage = ""
	if len(issues) > 0 {
		s.statusState = "degraded"
	} else {
		s.statusState = "healthy"
	}
	s.replaceIssuesLocked(issues, now)
	s.mu.Unlock()
}

func (s *Store) recordFileIssue(issue Issue, file RemoteFile, current map[string]candidate, issues map[string]Issue) {
	if previous, ok := s.lastGood[file.ID]; ok {
		current[file.ID] = previous
		issue.Route = previous.Entry.Slug
		issue.Fallback = "last_known_good_external"
	}
	issues[issue.Key] = issue
}

func (s *Store) emitReconciliationEventsLocked(current map[string]candidate, sourceFileIDs map[string]bool, now time.Time) {
	for fileID, parsed := range current {
		previous, existed := s.current.Candidates[fileID]
		if existed && previous.File.Revision == parsed.File.Revision {
			continue
		}
		s.emit(Event{
			Name:       "sync_file_succeeded",
			Severity:   "INFO",
			FileID:     parsed.File.ID,
			Path:       parsed.File.Path,
			Revision:   parsed.File.Revision,
			Route:      parsed.Entry.Slug,
			Message:    "file synchronized successfully",
			ObservedAt: now,
		})
		entryEvent := "sync_entry_added"
		if parsed.Mode == "overwrite" {
			entryEvent = "sync_entry_overwritten"
		}
		s.emit(Event{
			Name:       entryEvent,
			Severity:   "INFO",
			FileID:     parsed.File.ID,
			Path:       parsed.File.Path,
			Revision:   parsed.File.Revision,
			Route:      parsed.Entry.Slug,
			Message:    "external programming entry became active",
			ObservedAt: now,
		})
	}
	for fileID, previous := range s.current.Candidates {
		if sourceFileIDs[fileID] {
			continue
		}
		s.emit(Event{
			Name:       "sync_entry_deleted",
			Severity:   "INFO",
			FileID:     previous.File.ID,
			Path:       previous.File.Path,
			Revision:   previous.File.Revision,
			Route:      previous.Entry.Slug,
			Message:    "external programming entry was removed from the source",
			ObservedAt: now,
		})
	}
}

func environmentEligible(fileEnvironment, activeEnvironment Environment) bool {
	switch activeEnvironment {
	case EnvironmentProduction:
		return fileEnvironment == EnvironmentProduction
	case EnvironmentPreview:
		return fileEnvironment == EnvironmentProduction || fileEnvironment == EnvironmentPreview
	case EnvironmentLocal:
		return isEnvironment(fileEnvironment)
	default:
		return false
	}
}

func applyPublicationPolicy(current map[string]candidate, localRoutes map[string]int, lastGood map[string]candidate, issues *map[string]Issue, now time.Time) (map[string]candidate, map[string]candidate) {
	grouped := make(map[string][]candidate)
	for _, parsed := range current {
		grouped[parsed.Entry.Slug] = append(grouped[parsed.Entry.Slug], parsed)
	}

	active := make(map[string]candidate)
	masked := make(map[string]candidate)
	for slug, candidates := range grouped {
		if len(candidates) != 1 {
			owner, ownerOK := collisionOwner(candidates, lastGood, localRoutes)
			for _, parsed := range candidates {
				if ownerOK && parsed.File.ID == owner.File.ID {
					if owner.Entry.IsDraft {
						masked[owner.Entry.Slug] = owner
					} else {
						active[owner.File.ID] = owner
					}
					if owner.File.Revision != parsed.File.Revision {
						issue := fileIssue(parsed.File, "last_known_good", "current revision is not publishable; retaining the last-known-good revision", now)
						issue.Route = owner.Entry.Slug
						issue.Fallback = "last_known_good_external"
						(*issues)[issue.Key] = issue
					}
					continue
				}
				issue := fileIssue(parsed.File, "route_collision", "multiple valid external files claim the same programming route", now)
				issue.Route = slug
				(*issues)[issue.Key] = issue
				addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			}
			continue
		}

		parsed := candidates[0]
		if parsed.Mode == "add" && localRoutes[slug] > 0 {
			issue := fileIssue(parsed.File, "route_collision", "additive entry collides with a local programming route", now)
			issue.Route = slug
			(*issues)[issue.Key] = issue
			addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			continue
		}
		if parsed.Mode == "overwrite" && localRoutes[slug] != 1 {
			issue := fileIssue(parsed.File, "overwrite_target", "overwrite entry has no matching local programming route", now)
			issue.Route = slug
			(*issues)[issue.Key] = issue
			addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			continue
		}

		if parsed.Entry.IsDraft {
			masked[slug] = parsed
			continue
		}
		active[parsed.File.ID] = parsed
	}

	return active, masked
}

func collisionOwner(candidates []candidate, lastGood map[string]candidate, localRoutes map[string]int) (candidate, bool) {
	var owner candidate
	for _, parsed := range candidates {
		previous, ok := lastGood[parsed.File.ID]
		if !ok || previous.Entry.Slug != parsed.Entry.Slug {
			continue
		}
		if owner.File.ID != "" {
			return candidate{}, false
		}
		owner = parsed
	}
	if owner.File.ID == "" {
		return candidate{}, false
	}
	if candidatePublicationAllowed(owner, localRoutes) {
		return owner, true
	}
	previous := lastGood[owner.File.ID]
	if candidatePublicationAllowed(previous, localRoutes) {
		return previous, true
	}
	return candidate{}, false
}

func candidatePublicationAllowed(candidate candidate, localRoutes map[string]int) bool {
	if candidate.Mode == "add" {
		return localRoutes[candidate.Entry.Slug] == 0
	}
	return candidate.Mode == "overwrite" && localRoutes[candidate.Entry.Slug] == 1
}

func addLastGoodFallback(parsed candidate, lastGood map[string]candidate, grouped map[string][]candidate, localRoutes map[string]int, active, masked map[string]candidate, issues *map[string]Issue, now time.Time) {
	previous, ok := lastGood[parsed.File.ID]
	if !ok || !candidateAllowed(previous, grouped, localRoutes) {
		return
	}
	if previous.Entry.IsDraft {
		masked[previous.Entry.Slug] = previous
	} else {
		active[previous.File.ID] = previous
	}
	issue := fileIssue(parsed.File, "last_known_good", "current revision is not publishable; retaining the last-known-good revision", now)
	issue.Route = previous.Entry.Slug
	issue.Fallback = "last_known_good_external"
	(*issues)[issue.Key] = issue
}

func candidateAllowed(candidate candidate, grouped map[string][]candidate, localRoutes map[string]int) bool {
	for _, other := range grouped[candidate.Entry.Slug] {
		if other.File.ID != candidate.File.ID {
			return false
		}
	}
	return candidatePublicationAllowed(candidate, localRoutes)
}

func (s *Store) sourceFor(ctx context.Context, now time.Time) (Source, error) {
	if s.source != nil {
		return s.source, nil
	}
	if now.Before(s.nextSourceTry) && s.sourceError != nil {
		return nil, s.sourceError
	}
	if s.config.FolderID == "" || !isEnvironment(s.config.Environment) {
		s.sourceError = errInvalidSourceConfiguration
		s.nextSourceTry = now.Add(unrecoverableRetryInterval)
		return nil, s.sourceError
	}

	source, err := s.config.SourceFactory(ctx)
	if err != nil {
		s.sourceError = err
		if sourceFailureCategory(err) == "configuration_or_authorization_failure" {
			s.nextSourceTry = now.Add(unrecoverableRetryInterval)
		}
		return nil, err
	}
	s.source = source
	s.sourceError = nil
	s.nextSourceTry = time.Time{}
	return source, nil
}

func (s *Store) sourceFailure(err error, now time.Time) {
	category := sourceFailureCategory(err)
	issue := Issue{
		Key:        "source|" + category,
		Category:   category,
		Message:    sourceFailureMessage(category),
		ObservedAt: now,
	}

	s.mu.Lock()
	if category == "configuration_or_authorization_failure" {
		s.source = nil
		s.sourceError = err
		s.nextSourceTry = now.Add(unrecoverableRetryInterval)
		s.nextSyncTry = now.Add(unrecoverableRetryInterval)
	} else {
		s.nextSyncTry = now.Add(s.config.SyncInterval)
	}
	issues := make(map[string]Issue, len(s.activeIssues)+1)
	for key, active := range s.activeIssues {
		issues[key] = active
	}
	issues[issue.Key] = issue
	s.statusState = "degraded"
	s.statusStale = s.initialized
	s.statusMessage = issue.Message
	s.replaceIssuesLocked(issues, now)
	s.mu.Unlock()
}

func sourceFailureCategory(err error) string {
	if errors.Is(err, errInvalidSourceConfiguration) {
		return "configuration_or_authorization_failure"
	}
	var apiError *googleapi.Error
	if errors.As(err, &apiError) {
		switch {
		case apiError.Code == 408 || apiError.Code == 429 || apiError.Code >= 500:
			return "transient_source_failure"
		case apiError.Code == 401 || apiError.Code == 403 || apiError.Code == 404 || (apiError.Code >= 400 && apiError.Code < 500):
			return "configuration_or_authorization_failure"
		default:
			return "transient_source_failure"
		}
	}
	var networkError net.Error
	if errors.As(err, &networkError) {
		return "transient_source_failure"
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return "transient_source_failure"
	}
	return "transient_source_failure"
}

func sourceFailureMessage(category string) string {
	if category == "transient_source_failure" {
		return "Obsidian source temporarily unavailable; using the configured content fallback"
	}
	return "Obsidian source configuration or authorization requires operator action"
}

func (s *Store) replaceIssuesLocked(next map[string]Issue, now time.Time) {
	for key, issue := range next {
		if _, existed := s.activeIssues[key]; existed {
			continue
		}
		issue.ObservedAt = now
		s.config.NotificationLogger(issue)
		s.emit(Event{
			Name:       "sync_issue",
			Severity:   "ERROR",
			Category:   issue.Category,
			FileID:     issue.FileID,
			Path:       issue.Path,
			Revision:   issue.Revision,
			Reference:  issue.Reference,
			Route:      issue.Route,
			Fallback:   issue.Fallback,
			Message:    issue.Message,
			ObservedAt: now,
		})
	}
	for key, issue := range s.activeIssues {
		if _, stillActive := next[key]; stillActive {
			continue
		}
		s.emit(Event{
			Name:       "sync_issue_recovered",
			Severity:   "INFO",
			Category:   issue.Category,
			FileID:     issue.FileID,
			Path:       issue.Path,
			Revision:   issue.Revision,
			Reference:  issue.Reference,
			Route:      issue.Route,
			Message:    "synchronization issue resolved",
			ObservedAt: now,
		})
	}
	s.activeIssues = next
}

func (s *Store) emit(event Event) {
	s.config.EventLogger(event)
}
