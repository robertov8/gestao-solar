package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"gestao-solar/backend/internal/database"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	ctx := context.Background()
	db, err := database.Open(ctx, ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	assets := fstest.MapFS{
		"index.html":    {Data: []byte("<html>app</html>")},
		"assets/app.js": {Data: []byte("console.log(1)")},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := httptest.NewServer(New(db, assets, logger))
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, method, url string, body any) *http.Response {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, r)
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { res.Body.Close() })
	return res
}

func expectStatus(t *testing.T, res *http.Response, want int) {
	t.Helper()
	if res.StatusCode != want {
		body, _ := io.ReadAll(res.Body)
		t.Fatalf("%s %s: status %d, esperado %d: %s", res.Request.Method, res.Request.URL.Path, res.StatusCode, want, body)
	}
}

func decode[T any](t *testing.T, res *http.Response) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestHealth(t *testing.T) {
	srv := newTestServer(t)
	expectStatus(t, do(t, "GET", srv.URL+"/api/health", nil), http.StatusOK)
}

func TestRotasNaoAPI(t *testing.T) {
	srv := newTestServer(t)

	expectStatus(t, do(t, "GET", srv.URL+"/api/inexistente", nil), http.StatusNotFound)

	res := do(t, "GET", srv.URL+"/alguma/rota/do/cliente", nil)
	expectStatus(t, res, http.StatusOK)
	if body, _ := io.ReadAll(res.Body); string(body) != "<html>app</html>" {
		t.Fatalf("fallback SPA devolveu %q", body)
	}

	res = do(t, "GET", srv.URL+"/assets/app.js", nil)
	expectStatus(t, res, http.StatusOK)
	if cc := res.Header.Get("Cache-Control"); cc == "" {
		t.Fatal("assets sem Cache-Control")
	}
}
