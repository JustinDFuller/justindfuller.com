// Package grass handles make/project entries
package grass

import (
	"time"
)

// ProjectEntry represents a project with its metadata and content
type ProjectEntry struct {
	Title          string
	Slug           string
	URL            string
	FirstParagraph string
	Date           time.Time
	IsExternal     bool
}

// Entries contains all project entries for display
var Entries = []ProjectEntry{
	{
		Title:          "Notes",
		Slug:           "notes",
		URL:            "https://notes.justindfuller.com",
		FirstParagraph: "This notes app is a little different than some you might have used before. First, you may notice there are no styling options. That's because styling tends to get in the way. You won't find bold, italics, or any other styles. This helps you focus on what matters: writing notes.",
		Date:           time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
		IsExternal:     true,
	},
	{
		Title:          "Interviews",
		Slug:           "interviews",
		URL:            "https://interviews.justindfuller.com",
		FirstParagraph: "I've spent years interviewing candidates of all types and levels. But it never seemed to get easier. I struggled to compare candidates to each other. I never felt I had a clear signal that a candidate was right for the role.",
		Date:           time.Date(2023, 3, 15, 0, 0, 0, 0, time.UTC),
		IsExternal:     true,
	},
	{
		Title:          "Grass",
		Slug:           "grass",
		URL:            "/grass",
		FirstParagraph: "I'd like to help you figure out how much to water your grass. This is trickier than it may seem. The amount changes based on the grass type and natural rainfall. Overwatering wastes resources; hurts your grass; and may cause mold, fungus, and moss to grow in your yard.",
		Date:           time.Date(2022, 8, 10, 0, 0, 0, 0, time.UTC),
		IsExternal:     false,
	},
	{
		Title:          "A Game with Kit",
		Slug:           "kit",
		URL:            "/kit",
		FirstParagraph: "Dad, Can we make a game? Sure, buddy. What kind of game? On the computer! Let's make a game with a bunch of numbers all mixed up. You have to switch the numbers to put them in order.",
		Date:           time.Date(2022, 4, 20, 0, 0, 0, 0, time.UTC),
		IsExternal:     false,
	},
	{
		Title:          "Remaining Life",
		Slug:           "weeks-remaining",
		URL:            "/weeks-remaining",
		FirstParagraph: "Based on global averages, how many weeks do you have left to live? Find out and make it count.",
		Date:           time.Date(2021, 7, 12, 0, 0, 0, 0, time.UTC),
		IsExternal:     false,
	},
}