package site

import (
	"strings"

	"github.com/yuin/goldmark/util"

	"github.com/justindfuller/justindfuller.com/programming"
)

const siteOrigin = "https://www.justindfuller.com"

func absoluteImageURL(value string) string {
	switch {
	case !programming.ValidImageReference(value):
		return ""
	case strings.HasPrefix(value, "/"):
		return siteOrigin + value
	default:
		return value
	}
}

func previewImage(entry programming.Entry) (string, string) {
	if explicit := string(util.URLEscape([]byte(entry.Image), true)); absoluteImageURL(explicit) != "" {
		image, _ := programming.FindImage(entry.Content, explicit)
		return absoluteImageURL(explicit), image.Alt
	}
	if image, found := programming.FirstImage(entry.Content); found {
		if src := absoluteImageURL(image.Src); src != "" {
			return src, image.Alt
		}
	}
	return "", ""
}
