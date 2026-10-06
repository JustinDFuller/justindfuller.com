package site

import (
	"encoding/xml"
	"github.com/justindfuller/justindfuller.com/programming"
)

func LoadProgramming() ([]programming.Entry, error) {
	entries, err := programming.GetEntries()
	if err != nil {
		return nil, err
	}
	for index, entry := range entries {
		full, err := programming.GetEntry(entry.Slug)
		if err != nil {
			return nil, err
		}
		entries[index] = full
	}
	return entries, nil
}

func renderSitemap(paths []string) ([]byte, error) {
	type location struct {
		URL string `xml:"loc"`
	}
	var document struct {
		XMLName   xml.Name   `xml:"urlset"`
		Namespace string     `xml:"xmlns,attr"`
		URLs      []location `xml:"url"`
	}
	document.Namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
	for _, path := range paths {
		if path != "/sitemap.xml" {
			document.URLs = append(document.URLs, location{URL: "https://justindfuller.com" + path})
		}
	}
	body, err := xml.Marshal(document)
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), body...), nil
}
