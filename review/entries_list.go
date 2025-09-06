package review

import (
	"regexp"
	"strings"
	"time"
)

type ReviewEntry struct {
	Title          string
	Slug           string
	FirstParagraph string
	Date           time.Time
}

func extractFirstParagraph(content string) string {
	// Remove frontmatter if present
	lines := strings.Split(content, "\n")
	start := 0
	if len(lines) > 0 && strings.TrimSpace(lines[0]) == "---" {
		for i := 1; i < len(lines); i++ {
			if strings.TrimSpace(lines[i]) == "---" {
				start = i + 1
				break
			}
		}
	}
	
	// Join remaining lines
	text := strings.Join(lines[start:], "\n")
	
	// Remove headers and find first non-empty paragraph
	paragraphs := strings.Split(text, "\n\n")
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		// Skip empty lines, headers, code blocks, images, and centered text
		if p == "" || strings.HasPrefix(p, "#") || strings.HasPrefix(p, "```") || 
		   strings.HasPrefix(p, "<img") || strings.HasPrefix(p, "<p align") ||
		   strings.HasPrefix(p, "![") || strings.HasPrefix(p, ">") {
			continue
		}
		// Remove any markdown formatting but keep the text
		p = regexp.MustCompile(`\[([^\]]+)\]\([^\)]+\)`).ReplaceAllString(p, "$1") // Links
		p = regexp.MustCompile(`[*_]{1,2}([^*_]+)[*_]{1,2}`).ReplaceAllString(p, "$1") // Bold/italic
		p = regexp.MustCompile(`^[-*+] `).ReplaceAllString(p, "") // List markers
		p = strings.TrimSpace(p)
		if p != "" {
			return p
		}
	}
	return ""
}

// Entries contains all review entries for display
var Entries = []ReviewEntry{
	{
		Title:          "Zen and The Art of Motorcycle Maintenance",
		Slug:           "zen-and-the-art-of-motorcycle-maintenance",
		FirstParagraph: "Zen and the Art of Motorcycle Maintenance is the story of a man (or is it a ghost, a wolf, a lunatic?) searching for Quality.",
		Date:           time.Date(2022, 4, 14, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:          "Living on 24 Hours a Day",
		Slug:           "living-on-24-hours-a-day",
		FirstParagraph: "Halfway through last year, I found myself overwhelmed by my schedule. There were simply too many things to do and not enough time. As we bookworms tend to do, I set out to find books that would teach me to wrangle my schedule.",
		Date:           time.Date(2022, 1, 7, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:          "Howards End",
		Slug:           "howards-end",
		FirstParagraph: "Not the show. The novel, first published in 1910 by E.M. Forster.",
		Date:           time.Date(2021, 8, 28, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:          "Walden",
		Slug:           "walden",
		FirstParagraph: "Not about leaving society but finding humanity.",
		Date:           time.Date(2021, 5, 15, 0, 0, 0, 0, time.UTC),
	},
	{
		Title:          "The History of Modern Political Philosophy",
		Slug:           "the-history-of-modern-political-philosophy",
		FirstParagraph: "I took a class called \"The History of Modern Political Philosophy\" at UNC Charlotte in fall 2024 with Dr. Amber Knight. The following \"review\" is not critical but simply my review of what I learned during the class. I will focus on sharing the parts I found most interesting instead of being comprehensive. It is not meant to be academic; so there will be no references and almost everything is from memory.",
		Date:           time.Date(2024, 12, 15, 0, 0, 0, 0, time.UTC),
	},
}