package site

import "net/http"

type privateResponseWriter struct{ http.ResponseWriter }

func (w *privateResponseWriter) WriteHeader(code int) {
	w.Header().Set("Cache-Control", "private, no-store, no-transform")
	w.Header().Set("X-Robots-Tag", "noindex")
	w.ResponseWriter.WriteHeader(code)
}

func (w *privateResponseWriter) Write(body []byte) (int, error) {
	w.Header().Set("Cache-Control", "private, no-store, no-transform")
	w.Header().Set("X-Robots-Tag", "noindex")
	return w.ResponseWriter.Write(body)
}
