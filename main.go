package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/justindfuller/justindfuller.com/site"
)

func main() {
	handler, err := site.New()
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
		Addr:              port,
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
