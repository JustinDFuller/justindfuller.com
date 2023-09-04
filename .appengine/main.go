package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	http.Handle("/", http.NotFoundHandler())
	http.ListenAndServe(fmt.Sprintf(":%s", os.Getenv("PORT")), nil)
}
