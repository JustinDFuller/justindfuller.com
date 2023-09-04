package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/2022/01/living-on-24-hours-a-day", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/review/living-on-24-hours-a-day", http.StatusMovedPermanently)
	})

	http.Handle("/", http.NotFoundHandler())
	http.ListenAndServe(fmt.Sprintf(":%s", os.Getenv("PORT")), nil)
}
