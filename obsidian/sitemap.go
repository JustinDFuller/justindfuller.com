package obsidian

import (
	"bytes"
	"encoding/xml"
	"net/url"
	"strings"

	"github.com/justindfuller/justindfuller.com/programming"
)

type sitemapDocument struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc      string `xml:"loc"`
	LastMod  string `xml:"lastmod,omitempty"`
	Priority string `xml:"priority,omitempty"`
}

func BuildSitemap(base []byte, entries []programming.Entry, siteURL string) ([]byte, error) {
	var document sitemapDocument
	if err := xml.Unmarshal(base, &document); err != nil {
		return nil, err
	}
	if document.XMLNS == "" {
		document.XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9"
	}

	seen := make(map[string]bool, len(document.URLs))
	urls := make([]sitemapURL, 0, len(document.URLs)+len(entries))
	for _, entry := range document.URLs {
		if strings.HasPrefix(entry.Loc, strings.TrimSuffix(siteURL, "/")+"/programming/") {
			continue
		}
		if !seen[entry.Loc] {
			seen[entry.Loc] = true
			urls = append(urls, entry)
		}
	}

	baseURL := strings.TrimSuffix(siteURL, "/")
	for _, entry := range entries {
		loc := baseURL + "/programming/" + url.PathEscape(entry.Slug)
		if seen[loc] {
			continue
		}
		seen[loc] = true
		urls = append(urls, sitemapURL{
			Loc:      loc,
			LastMod:  entry.Date.Format("2006-01-02T15:04:05Z07:00"),
			Priority: "0.64",
		})
	}
	document.URLs = urls

	var output bytes.Buffer
	output.WriteString(xml.Header)
	encoder := xml.NewEncoder(&output)
	encoder.Indent("", "  ")
	if err := encoder.Encode(document); err != nil {
		return nil, err
	}
	if err := encoder.Flush(); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func LocalOnlySitemap(base []byte, siteURL string) ([]byte, error) {
	return BuildSitemap(base, nil, siteURL)
}

func FallbackSitemap() []byte {
	site := "https://justindfuller.com"
	lastModified := "2024-01-09T01:47:18+00:00"
	urls := []sitemapURL{
		{Loc: site + "/", LastMod: lastModified, Priority: "1.00"},
		{Loc: site + "/aphorism", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/poem", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/story", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/word", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/make", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/review", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/nature", LastMod: lastModified, Priority: "0.80"},
		{Loc: site + "/story/the_philosophy_of_trees", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/story/nothing", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/story/bridge", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/word/quality", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/word/flexible", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/grass", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/kit", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/review/zen-and-the-art-of-motorcycle-maintenance", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/review/living-on-24-hours-a-day", LastMod: lastModified, Priority: "0.64"},
		{Loc: site + "/review/howards-end", LastMod: lastModified, Priority: "0.64"},
	}
	document := sitemapDocument{
		XMLName: xml.Name{Local: "urlset"},
		XMLNS:   "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:    urls,
	}
	encoded, err := xml.Marshal(document)
	if err != nil {
		return []byte{}
	}
	return append([]byte(xml.Header), encoded...)
}
