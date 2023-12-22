package main

import (
	"log"
	"os"
	"strings"
	"text/template"
)

type Route struct {
	Path        string
	File        string
	Directory   string
	ContentType string
}

func main() {
	var appYamlTmpl = template.Must(template.ParseFiles("./.routes/app.yaml.tmpl"))

	routes := []Route{
		{
			Path:      "/image",
			Directory: "image",
		},
		{
			Path:        "/aphorism",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/poem",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/story",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/story/the_philosophy_of_trees",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/story/the_philosophy_of_lovers",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/story/bridge",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/story/nothing",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/review",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/review/zen-and-the-art-of-motorcycle-maintenance",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/review/living-on-24-hours-a-day",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/review/howards-end",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/make",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/grass/worker.js",
			File:        "grass-service-worker.js",
			ContentType: "application/javascript",
		},
		{
			Path:        "/grass",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/kit",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/word/quality",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/word/equipoise",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/word/flexible",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/word",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/nature",
			ContentType: "text/html; charset=utf-8",
		},
		{
			Path:        "/site.webmanifest",
			File:        "site.webmanifest",
			ContentType: "application/manifest+json",
		},
		{
			Path:        "/",
			File:        "index.html",
			ContentType: "text/html; charset=utf-8",
		},
	}

	for i := range routes {
		route := routes[i]

		if route.Directory != "" {
			continue
		}

		if route.File != "" {
			continue
		}

		split := strings.Split(route.Path, "/")
		route.File = split[len(split)-1] + ".html"

		routes[i] = route
	}

	if err := os.Remove("./.appengine/app.yaml"); err != nil {
		log.Fatalf("Error removing .appengine/app.yaml: %s", err)
	}

	f, err := os.OpenFile("./.appengine/app.yaml", os.O_RDWR|os.O_CREATE, 0666)
	if err != nil {
		log.Fatalf("Error opening app.yaml file: %s", err)
	}

	if err := appYamlTmpl.Execute(f, routes); err != nil {
		log.Fatalf("Error executing app.yaml.tmpl: %s", err)
	}

	if err := f.Close(); err != nil {
		log.Fatalf("ERror closing app.yaml file: %s", err)
	}

	log.Print("Wrote app.yaml file")

}
