package story

import (
	"time"
)

type StoryEntry struct {
	Title          string
	SubTitle       string // Optional subtitle field for compatibility with shared template
	Slug           string
	FirstParagraph string
	Date           time.Time
	IsDraft        bool
}

// Entries contains all story entries for display
var Entries = []StoryEntry{
	{
		Title:          "The Philosophy of Trees",
		Slug:           "the_philosophy_of_trees",
		FirstParagraph: "The story I have to tell you today is not the story I wished to tell. In fact, I am loath to repeat much of it. I pray antiquity and modernity alike judge me not as an author, nor even as editor, but as a trembling witness. Reluctant to confess what he has seen, yet compelled by his conscience to reveal the devilry that took place at the autumn equinox on the outskirts of a great Carolina wilderness.",
		Date:           time.Date(2022, 9, 18, 0, 0, 0, 0, time.UTC),
		IsDraft:        false,
	},
	{
		Title:          "Nothing",
		Slug:           "nothing",
		FirstParagraph: "Nothing wasn't quite what I expected it to be. I think I expected emptiness; nothing is a little different that empty. In order for there to be nothing there can't even be me. When I thought about emptiness I was really thinking of emptiness except for me. All that nothing — or is it, none of that nothing? — I expected a vast darkness, like I was floating around in space. Instead, I was alive one moment, then nothing.",
		Date:           time.Date(2020, 1, 31, 0, 0, 0, 0, time.UTC),
		IsDraft:        true,
	},
	{
		Title:          "Bridge",
		Slug:           "bridge",
		FirstParagraph: "Water is still pouring out. Maybe not quite as much as before, I can't remember. Even so, it doesn't look like it's going to be a problem. The river is hundreds of feet below. Still, I remember this whole region is a flood zone if the dam breaks. People used to talk about how everything would break down once people were gone. There was a book about it. The subways of New York would flood, homes would be overtaken by nature, bridges would fall, and dams would collapse.",
		Date:           time.Date(2019, 12, 28, 0, 0, 0, 0, time.UTC),
		IsDraft:        true,
	},
	{
		Title:          "The Philosophy of Lovers",
		Slug:           "the_philosophy_of_lovers",
		FirstParagraph: "Raemi sat on his favorite stone at the edge of the garden that surrounded the market. Before him huddled a group of a dozen women with their children and bored teenagers who were looking for something to do. Scanning the group, he asked, \"Who wants to try today's question first?\"",
		Date:           time.Date(2023, 12, 9, 0, 0, 0, 0, time.UTC),
		IsDraft:        true,
	},
}

// GetPublishedEntries returns only non-draft entries
func GetPublishedEntries() []StoryEntry {
	var published []StoryEntry
	for _, entry := range Entries {
		if !entry.IsDraft {
			published = append(published, entry)
		}
	}
	return published
}