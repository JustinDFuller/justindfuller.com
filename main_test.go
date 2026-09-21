package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWithSyncCacheDisablesDynamicContentCaching(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/programming", nil)
	response := httptest.NewRecorder()
	withSyncCache(func(http.ResponseWriter, *http.Request) {})(response, request)
	if got := response.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
}
