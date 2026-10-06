package main

import (
	"github.com/justindfuller/justindfuller.com/obsidian"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/site"
)

func main() {
	var handler http.Handler
	var err error
	if overlay := os.Getenv("OBSIDIAN_OVERLAY"); overlay != "" {
		prepared, loadErr := obsidian.LoadPrepared(overlay, obsidian.ModeLocal)
		if loadErr != nil {
			log.Fatal("Invalid private local overlay")
		}
		handler, err = site.NewWithPrepared(prepared, obsidian.ModeLocal)
	} else {
		handler, err = site.New()
	}
	if err != nil {
		log.Fatal(err)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}
	server := http.Server{
		Addr:              "127.0.0.1" + port,
		Handler:           handler,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	log.Printf("Listening on %s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
