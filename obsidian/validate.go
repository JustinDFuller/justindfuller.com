package obsidian

import (
	"bytes"
	"encoding/base64"
	"encoding/xml"
	"errors"
	"fmt"
	htmlstd "html"
	"image/jpeg"
	"image/png"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/justindfuller/justindfuller.com/programming"
	"golang.org/x/net/html"
	"gopkg.in/yaml.v3"
)

var (
	allowedMetadataKeys = map[string]bool{
		"environment": true,
		"section":     true,
		"slug":        true,
		"title":       true,
		"date":        true,
		"draft":       true,
		"sync":        true,
		"tags":        true,
		"subtitle":    true,
		"description": true,
	}
	slugPattern      = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	obsidianImage    = regexp.MustCompile(`!\[\[([^\]\n]+)\]\]`)
	renderedImage    = regexp.MustCompile(`(?is)<img\b[^>]*>`)
	renderedSrc      = regexp.MustCompile(`(?is)\bsrc\s*=\s*["']?([^"'\s>]+)`)
	unsupportedObsid = regexp.MustCompile(`!\[\[|\[\[[^\]\n]+\]\]|(?m)^\s*>\s*\[![A-Za-z0-9_-]+\]|(?m)(?:^|\s)\^[-a-zA-Z0-9_]+\s*$|(?s)%%.*?%%`)
)

type metadata struct {
	Environment Environment
	Section     string
	Slug        string
	Title       string
	Subtitle    string
	Description string
	Date        time.Time
	Draft       bool
	Sync        string
	Tags        []string
}

type candidate struct {
	File        RemoteFile
	Entry       programming.Entry
	Environment Environment
	Mode        string
	Assets      map[string]Asset
}

type assetIndex struct {
	ByPath map[string][]RemoteFile
	ByName map[string][]RemoteFile
}

func buildAssetIndex(files []RemoteFile) assetIndex {
	index := assetIndex{
		ByPath: make(map[string][]RemoteFile),
		ByName: make(map[string][]RemoteFile),
	}

	for _, file := range files {
		if file.IsFolder || !strings.HasPrefix(file.Path, "image/") || !isSupportedImage(file.Path) {
			continue
		}

		relative := strings.TrimPrefix(file.Path, "image/")
		index.ByPath[relative] = append(index.ByPath[relative], file)
		index.ByName[file.Name] = append(index.ByName[file.Name], file)
	}

	return index
}

func isSupportedImage(name string) bool {
	return strings.HasSuffix(name, ".jpg") || strings.HasSuffix(name, ".png") || strings.HasSuffix(name, ".svg")
}

func imageContentType(name string) string {
	switch {
	case strings.HasSuffix(name, ".jpg"):
		return "image/jpeg"
	case strings.HasSuffix(name, ".png"):
		return "image/png"
	case strings.HasSuffix(name, ".svg"):
		return "image/svg+xml"
	default:
		return "application/octet-stream"
	}
}

func imageToken(file RemoteFile) string {
	return base64.RawURLEncoding.EncodeToString([]byte(file.ID + "|" + file.Revision))
}

func validateMarkdown(
	file RemoteFile,
	raw []byte,
	index assetIndex,
	download func(string) ([]byte, error),
	now time.Time,
) (candidate, []Issue) {
	issues := make([]Issue, 0, 1)
	if !utf8.Valid(raw) {
		return candidate{}, []Issue{fileIssue(file, "markdown_encoding", "Markdown is not valid UTF-8", now)}
	}

	frontMatter, body, err := splitFrontMatter(string(raw))
	if err != nil {
		return candidate{}, []Issue{fileIssue(file, "markdown_front_matter", err.Error(), now)}
	}

	metadata, err := parseMetadata(frontMatter)
	if err != nil {
		return candidate{}, []Issue{fileIssue(file, "markdown_metadata", err.Error(), now)}
	}

	if strings.TrimSpace(body) == "" {
		return candidate{}, []Issue{fileIssue(file, "markdown_body", "Markdown body is empty", now)}
	}

	body, rawImageIssues := stripRawHTMLImages(body, file, now)
	for index := range rawImageIssues {
		rawImageIssues[index].Route = metadata.Slug
	}
	issues = append(issues, rawImageIssues...)
	rewrittenBody, assets, imageIssues := rewriteImages(body, index, download, file, now)
	for index := range imageIssues {
		imageIssues[index].Route = metadata.Slug
	}
	issues = append(issues, imageIssues...)
	for _, issue := range imageIssues {
		if issue.Category == "markdown_image_syntax" {
			return candidate{}, issues
		}
	}
	if containsUnsupportedObsidianSyntax(rewrittenBody) {
		return candidate{}, append(issues, fileIssue(file, "markdown_syntax", "unsupported Obsidian syntax", now))
	}

	rendered, err := programming.RenderMarkdown([]byte("---\n" + frontMatter + "\n---\n" + rewrittenBody))
	if err != nil {
		return candidate{}, append(issues, fileIssue(file, "markdown_render", "Markdown could not be rendered", now))
	}
	if containsProhibitedRenderedContent(string(rendered)) {
		return candidate{}, append(issues, fileIssue(file, "markdown_safety", "rendered content contains prohibited executable or traversal content", now))
	}

	firstParagraph := htmlstd.EscapeString(programming.ExtractFirstParagraph("---\n" + frontMatter + "\n---\n" + body))
	description := htmlstd.EscapeString(metadata.Description)
	if description == "" {
		description = firstParagraph
	}
	entry := programming.Entry{
		Title:          htmlstd.EscapeString(metadata.Title),
		SubTitle:       htmlstd.EscapeString(metadata.Subtitle),
		Slug:           metadata.Slug,
		Description:    description,
		FirstParagraph: firstParagraph,
		Content:        rendered,
		Date:           metadata.Date,
		IsDraft:        metadata.Draft,
	}
	return candidate{
		File:        file,
		Entry:       entry,
		Environment: metadata.Environment,
		Mode:        metadata.Sync,
		Assets:      assets,
	}, issues
}

func stripRawHTMLImages(markdown string, file RemoteFile, now time.Time) (string, []Issue) {
	issues := make([]Issue, 0, 1)
	masked := maskMarkdownCode(markdown)
	matches := renderedImage.FindAllStringIndex(masked, -1)
	if len(matches) == 0 {
		return markdown, issues
	}
	var result strings.Builder
	previous := 0
	for _, match := range matches {
		result.WriteString(markdown[previous:match[0]])
		parts := renderedSrc.FindStringSubmatch(markdown[match[0]:match[1]])
		if len(parts) == 2 {
			issues = append(issues, imageIssue(file, parts[1], "image_reference_outside_source", now))
		} else {
			issues = append(issues, imageIssue(file, "", "markdown_image_syntax", now))
		}
		previous = match[1]
	}
	result.WriteString(markdown[previous:])
	return result.String(), issues
}

func maskMarkdownCode(markdown string) string {
	masked := []byte(markdown)
	marker := byte(0)
	markerLength := 0
	offset := 0
	for _, line := range strings.SplitAfter(markdown, "\n") {
		_, lineLength, isFence := markdownFence(line)
		if marker != 0 {
			maskMarkdownRange(masked, offset, offset+len(line))
			if isFence && line[leadingFenceOffset(line)] == marker && lineLength >= markerLength && markdownFenceCloses(line, marker, markerLength) {
				marker = 0
				markerLength = 0
			}
			offset += len(line)
			continue
		}
		if isFence {
			marker = line[leadingFenceOffset(line)]
			markerLength = lineLength
			maskMarkdownRange(masked, offset, offset+len(line))
			offset += len(line)
			continue
		}
		if markdownIsIndentedCode(line) {
			maskMarkdownRange(masked, offset, offset+len(line))
			offset += len(line)
			continue
		}
		offset += len(line)
	}
	maskInlineCode(masked)
	return string(masked)
}

func containsUnsupportedObsidianSyntax(markdown string) bool {
	return unsupportedObsid.MatchString(maskMarkdownCode(markdown))
}

func markdownFence(line string) (byte, int, bool) {
	leading := 0
	for leading < len(line) && leading < 4 && line[leading] == ' ' {
		leading++
	}
	if leading > 3 || leading >= len(line) || (line[leading] != '`' && line[leading] != '~') {
		return 0, 0, false
	}
	marker := line[leading]
	count := 0
	for leading+count < len(line) && line[leading+count] == marker {
		count++
	}
	if count < 3 {
		return 0, 0, false
	}
	return marker, count, true
}

func leadingFenceOffset(line string) int {
	offset := 0
	for offset < len(line) && offset < 4 && line[offset] == ' ' {
		offset++
	}
	return offset
}

func markdownFenceCloses(line string, marker byte, minimumLength int) bool {
	foundMarker, length, ok := markdownFence(line)
	if !ok || foundMarker != marker || length < minimumLength {
		return false
	}
	remaining := line[leadingFenceOffset(line)+length:]
	return strings.TrimSpace(remaining) == ""
}

func markdownIsIndentedCode(line string) bool {
	spaces := 0
	for spaces < len(line) && line[spaces] == ' ' {
		spaces++
	}
	return spaces >= 4 || (spaces < len(line) && line[spaces] == '\t')
}

func maskMarkdownRange(masked []byte, start, end int) {
	for index := start; index < end && index < len(masked); index++ {
		if masked[index] != '\n' && masked[index] != '\r' {
			masked[index] = ' '
		}
	}
}

func maskInlineCode(masked []byte) {
	for index := 0; index < len(masked); {
		if masked[index] != '`' {
			index++
			continue
		}
		count := 0
		for index+count < len(masked) && masked[index+count] == '`' {
			count++
		}
		fence := strings.Repeat("`", count)
		end := bytes.Index(masked[index+count:], []byte(fence))
		if end < 0 {
			index += count
			continue
		}
		end += index + count + count
		maskMarkdownRange(masked, index, end)
		index = end
	}
}

func containsProhibitedRenderedContent(rendered string) bool {
	document, err := html.Parse(strings.NewReader(rendered))
	if err != nil {
		return true
	}

	var visit func(*html.Node) bool
	visit = func(node *html.Node) bool {
		if node.Type == html.ElementNode {
			switch strings.ToLower(node.Data) {
			case "script", "iframe", "object", "embed", "form", "style", "link":
				return true
			}
			for _, attribute := range node.Attr {
				name := strings.ToLower(attribute.Key)
				if strings.HasPrefix(name, "on") {
					return true
				}
				if name != "href" && name != "src" && name != "action" && name != "formaction" && name != "xlink:href" {
					continue
				}
				value := strings.TrimSpace(strings.ToLower(html.UnescapeString(attribute.Val)))
				if strings.HasPrefix(value, "javascript:") || strings.Contains(value, "../") || strings.Contains(value, `..\`) {
					return true
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			if visit(child) {
				return true
			}
		}
		return false
	}

	return visit(document)
}

func splitFrontMatter(markdown string) (string, string, error) {
	lines := strings.Split(strings.ReplaceAll(markdown, "\r\n", "\n"), "\n")
	if len(lines) == 0 || strings.TrimSpace(lines[0]) != "---" {
		return "", "", fmt.Errorf("front matter is required")
	}

	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			return strings.Join(lines[1:i], "\n"), strings.Join(lines[i+1:], "\n"), nil
		}
	}

	return "", "", fmt.Errorf("front matter is not closed")
}

func parseMetadata(frontMatter string) (metadata, error) {
	var values map[string]interface{}
	if err := yaml.Unmarshal([]byte(frontMatter), &values); err != nil {
		return metadata{}, fmt.Errorf("front matter is not parseable")
	}
	if values == nil {
		return metadata{}, fmt.Errorf("front matter is empty")
	}

	for key := range values {
		if !allowedMetadataKeys[key] {
			return metadata{}, fmt.Errorf("unsupported metadata key %q", key)
		}
	}

	environment, err := stringValue(values, "environment", true)
	if err != nil || !isEnvironment(Environment(environment)) {
		return metadata{}, fmt.Errorf("environment must be prd, pr, or local")
	}
	section, err := stringValue(values, "section", true)
	if err != nil || section != "programming" {
		return metadata{}, fmt.Errorf("section must be programming")
	}
	slug, err := stringValue(values, "slug", true)
	if err != nil || !slugPattern.MatchString(slug) {
		return metadata{}, fmt.Errorf("slug must be lowercase kebab-case")
	}
	title, err := stringValue(values, "title", true)
	if err != nil || strings.TrimSpace(title) == "" {
		return metadata{}, fmt.Errorf("title must be a non-empty string")
	}
	date, err := dateValue(values, "date")
	if err != nil {
		return metadata{}, err
	}
	draft, err := boolValue(values, "draft")
	if err != nil {
		return metadata{}, err
	}
	syncMode, err := stringValue(values, "sync", true)
	if err != nil || (syncMode != "add" && syncMode != "overwrite") {
		return metadata{}, fmt.Errorf("sync must be add or overwrite")
	}
	tags, err := tagsValue(values, "tags")
	if err != nil {
		return metadata{}, err
	}
	subtitle, err := stringValue(values, "subtitle", false)
	if err != nil {
		return metadata{}, err
	}
	description, err := stringValue(values, "description", false)
	if err != nil {
		return metadata{}, err
	}

	return metadata{
		Environment: Environment(environment),
		Section:     section,
		Slug:        slug,
		Title:       title,
		Subtitle:    subtitle,
		Description: description,
		Date:        date,
		Draft:       draft,
		Sync:        syncMode,
		Tags:        tags,
	}, nil
}

func stringValue(values map[string]interface{}, key string, required bool) (string, error) {
	value, ok := values[key]
	if !ok {
		if required {
			return "", fmt.Errorf("metadata field %q is required", key)
		}
		return "", nil
	}
	stringValue, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("metadata field %q must be a string", key)
	}
	return stringValue, nil
}

func boolValue(values map[string]interface{}, key string) (bool, error) {
	value, ok := values[key]
	if !ok {
		return false, fmt.Errorf("metadata field %q is required", key)
	}
	boolean, ok := value.(bool)
	if !ok {
		return false, fmt.Errorf("metadata field %q must be a boolean", key)
	}
	return boolean, nil
}

func dateValue(values map[string]interface{}, key string) (time.Time, error) {
	value, ok := values[key]
	if !ok {
		return time.Time{}, fmt.Errorf("metadata field %q is required", key)
	}

	switch date := value.(type) {
	case time.Time:
		return time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC), nil
	case string:
		parsed, err := time.Parse("2006-01-02", date)
		if err != nil {
			return time.Time{}, fmt.Errorf("metadata field %q must be a valid YYYY-MM-DD date", key)
		}
		return parsed, nil
	default:
		return time.Time{}, fmt.Errorf("metadata field %q must be a valid YYYY-MM-DD date", key)
	}
}

func tagsValue(values map[string]interface{}, key string) ([]string, error) {
	value, ok := values[key]
	if !ok {
		return nil, fmt.Errorf("metadata field %q is required", key)
	}
	items, ok := value.([]interface{})
	if !ok || len(items) == 0 {
		return nil, fmt.Errorf("metadata field %q must be a non-empty list of strings", key)
	}

	tags := make([]string, 0, len(items))
	for _, item := range items {
		tag, ok := item.(string)
		if !ok || strings.TrimSpace(tag) == "" {
			return nil, fmt.Errorf("metadata field %q must be a non-empty list of strings", key)
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

type markdownImageMatch struct {
	start     int
	end       int
	alt       string
	reference string
}

func rewriteImages(body string, index assetIndex, download func(string) ([]byte, error), file RemoteFile, now time.Time) (string, map[string]Asset, []Issue) {
	assets := make(map[string]Asset)
	issues := make([]Issue, 0, 1)
	rewrite := func(_, alt, reference string) string {
		remote, ok, category := resolveAsset(reference, index)
		if !ok {
			issues = append(issues, imageIssue(file, reference, category, now))
			return ""
		}

		token := imageToken(remote)
		if _, loaded := assets[token]; !loaded {
			data, err := download(remote.ID)
			if err != nil {
				issues = append(issues, imageIssue(file, reference, "image_download", now))
				return ""
			}
			if err := validateImageData(remote.Path, data); err != nil {
				issues = append(issues, imageIssue(file, reference, "image_validation", now))
				return ""
			}
			assets[token] = Asset{
				Token:       token,
				FileID:      remote.ID,
				Path:        remote.Path,
				Revision:    remote.Revision,
				ContentType: imageContentType(remote.Path),
				Data:        data,
			}
		}

		return fmt.Sprintf("![%s](/__obsidian/image/%s)", alt, token)
	}

	masked := maskMarkdownCode(body)
	markdownMatches := findMarkdownImageMatches(body, masked)
	obsidianMatches := obsidianImage.FindAllStringIndex(masked, -1)
	result := rewriteMarkdownImages(body, markdownMatches, rewrite)
	result = rewriteObsidianImages(result, rewrite)

	remaining := []byte(masked)
	for _, match := range markdownMatches {
		maskMarkdownRange(remaining, match.start, match.end)
	}
	for _, match := range obsidianMatches {
		maskMarkdownRange(remaining, match[0], match[1])
	}
	if strings.Contains(string(remaining), "![") {
		issues = append(issues, fileIssue(file, "markdown_image_syntax", "image reference syntax is malformed", now))
	}

	return result, assets, issues
}

func rewriteMarkdownImages(markdown string, matches []markdownImageMatch, rewrite func(string, string, string) string) string {
	if len(matches) == 0 {
		return markdown
	}

	var result strings.Builder
	previous := 0
	for _, match := range matches {
		result.WriteString(markdown[previous:match.start])
		result.WriteString(rewrite(markdown[match.start:match.end], match.alt, match.reference))
		previous = match.end
	}
	result.WriteString(markdown[previous:])
	return result.String()
}

func findMarkdownImageMatches(markdown, masked string) []markdownImageMatch {
	matches := make([]markdownImageMatch, 0, 1)
	for offset := 0; offset < len(markdown); {
		relative := strings.Index(masked[offset:], "![")
		if relative < 0 {
			break
		}
		start := offset + relative
		altEnd := strings.IndexByte(markdown[start+2:], ']')
		if altEnd < 0 {
			break
		}
		altEnd += start + 2
		if altEnd+1 >= len(markdown) || markdown[altEnd+1] != '(' {
			offset = altEnd + 1
			continue
		}
		end, reference, ok := parseMarkdownImageDestination(markdown, altEnd+2)
		if !ok {
			offset = altEnd + 2
			continue
		}
		matches = append(matches, markdownImageMatch{
			start:     start,
			end:       end,
			alt:       markdown[start+2 : altEnd],
			reference: reference,
		})
		offset = end
	}
	return matches
}

func parseMarkdownImageDestination(markdown string, start int) (int, string, bool) {
	if start < len(markdown) && markdown[start] == '<' {
		closing := strings.IndexByte(markdown[start+1:], '>')
		if closing < 0 {
			return 0, "", false
		}
	}
	depth := 0
	for offset := start; offset < len(markdown); offset++ {
		switch markdown[offset] {
		case '\\':
			offset++
		case '\n', '\r':
			return 0, "", false
		case '(':
			depth++
		case ')':
			if depth == 0 {
				return offset + 1, imageReference(markdown[start:offset]), true
			}
			depth--
		}
	}
	return 0, "", false
}

func rewriteObsidianImages(markdown string, rewrite func(string, string, string) string) string {
	masked := maskMarkdownCode(markdown)
	matches := obsidianImage.FindAllStringIndex(masked, -1)
	if len(matches) == 0 {
		return markdown
	}

	var result strings.Builder
	previous := 0
	for _, match := range matches {
		result.WriteString(markdown[previous:match[0]])
		rawReference := markdown[match[0]+3 : match[1]-2]
		reference := rawReference
		alt := reference
		if separator := strings.Index(reference, "|"); separator >= 0 {
			alt = strings.TrimSpace(reference[separator+1:])
			reference = strings.TrimSpace(reference[:separator])
		}
		result.WriteString(rewrite(markdown[match[0]:match[1]], alt, reference))
		previous = match[1]
	}
	result.WriteString(markdown[previous:])
	return result.String()
}

func validateImageData(name string, data []byte) error {
	switch {
	case strings.HasSuffix(name, ".jpg"):
		_, err := jpeg.Decode(bytes.NewReader(data))
		return err
	case strings.HasSuffix(name, ".png"):
		_, err := png.Decode(bytes.NewReader(data))
		return err
	case strings.HasSuffix(name, ".svg"):
		decoder := xml.NewDecoder(bytes.NewReader(data))
		rootSeen := false
		for {
			token, err := decoder.Token()
			if err != nil {
				if errors.Is(err, io.EOF) && rootSeen {
					return nil
				}
				return err
			}
			element, ok := token.(xml.StartElement)
			if !ok {
				continue
			}
			if !rootSeen {
				if element.Name.Local != "svg" {
					return fmt.Errorf("SVG root element is required")
				}
				rootSeen = true
			}
			if element.Name.Local == "script" || element.Name.Local == "foreignObject" {
				return fmt.Errorf("SVG contains executable content")
			}
			for _, attribute := range element.Attr {
				attributeName := strings.ToLower(attribute.Name.Local)
				attributeValue := strings.ToLower(strings.TrimSpace(attribute.Value))
				if strings.HasPrefix(attributeName, "on") || strings.HasPrefix(attributeValue, "javascript:") {
					return fmt.Errorf("SVG contains executable content")
				}
			}
		}
	default:
		return fmt.Errorf("unsupported image format")
	}
}

func imageReference(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "<") {
		if end := strings.IndexByte(value, '>'); end > 0 {
			return unescapeMarkdownDestination(value[1:end])
		}
		return value
	}
	if fields := strings.Fields(value); len(fields) > 0 {
		return unescapeMarkdownDestination(fields[0])
	}
	return value
}

func unescapeMarkdownDestination(value string) string {
	var result strings.Builder
	for offset := 0; offset < len(value); offset++ {
		if value[offset] == '\\' && offset+1 < len(value) && strings.ContainsRune("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~", rune(value[offset+1])) {
			offset++
		}
		result.WriteByte(value[offset])
	}
	return result.String()
}

func resolveAsset(reference string, index assetIndex) (RemoteFile, bool, string) {
	if reference == "" || strings.Contains(reference, "?") || strings.Contains(reference, "#") || strings.HasPrefix(reference, "/") || strings.Contains(reference, "://") || strings.HasPrefix(reference, "data:") || strings.HasPrefix(reference, "../") || strings.Contains(reference, "/../") || strings.Contains(reference, `\..\`) {
		return RemoteFile{}, false, "image_reference_outside_source"
	}

	reference = strings.TrimPrefix(reference, "./")
	reference = strings.TrimPrefix(reference, "image/")
	if reference == "" {
		return RemoteFile{}, false, "image_not_found"
	}
	if strings.Contains(reference, ".") && !isSupportedImage(reference) {
		return RemoteFile{}, false, "image_validation"
	}

	if strings.Contains(reference, "/") {
		matches := index.ByPath[reference]
		if len(matches) == 1 {
			return matches[0], true, ""
		}
		if len(matches) > 1 {
			return RemoteFile{}, false, "image_ambiguous"
		}
		return RemoteFile{}, false, "image_not_found"
	}

	matches := index.ByName[reference]
	if len(matches) == 1 {
		return matches[0], true, ""
	}
	if len(matches) > 1 {
		return RemoteFile{}, false, "image_ambiguous"
	}
	return RemoteFile{}, false, "image_not_found"
}

func isEnvironment(environment Environment) bool {
	return environment == EnvironmentProduction || environment == EnvironmentPreview || environment == EnvironmentLocal
}

func fileIssue(file RemoteFile, category, message string, now time.Time) Issue {
	return Issue{
		Key:        issueKey(file.ID, file.Path, file.Revision, category, ""),
		FileID:     file.ID,
		Path:       file.Path,
		Revision:   file.Revision,
		Category:   category,
		Message:    message,
		ObservedAt: now,
	}
}

func imageIssue(file RemoteFile, reference, category string, now time.Time) Issue {
	issue := fileIssue(file, category, "image reference is invalid or unavailable", now)
	issue.Key = issueKey(file.ID, file.Path, file.Revision, category, reference)
	issue.Reference = reference
	return issue
}

func issueKey(fileID, path, revision, category, route string) string {
	return strings.Join([]string{fileID, path, revision, category, route}, "|")
}

func sortIssues(issues []Issue) {
	sort.Slice(issues, func(i, j int) bool {
		return issues[i].Key < issues[j].Key
	})
}
