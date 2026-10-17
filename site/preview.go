package site

import (
	"strings"

	"github.com/justindfuller/justindfuller.com/programming"
)

const siteOrigin = "https://www.justindfuller.com"

func absoluteImageURL(value string) string {
	switch {
	case strings.HasPrefix(value, "https://"):
		return value
	case strings.HasPrefix(value, "/"):
		return siteOrigin + value
	default:
		return ""
	}
}

func previewImage(entry programming.Entry) (string, string) {
	if src := absoluteImageURL(entry.Image); src != "" {
		image, _ := programming.FindImage(entry.Content, entry.Image)
		return src, image.Alt
	}
	if image, found := programming.FirstImage(entry.Content); found {
		if src := absoluteImageURL(image.Src); src != "" {
			return src, image.Alt
		}
	}
	return "", ""
}
