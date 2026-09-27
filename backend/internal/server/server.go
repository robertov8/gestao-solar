package server

import (
	"database/sql"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"gestao-solar/backend/internal/allocations"
	"gestao-solar/backend/internal/httpx"
	"gestao-solar/backend/internal/records"
	"gestao-solar/backend/internal/units"
)

// New monta o handler HTTP da aplicação. Se assets for nil, apenas a API é servida.
func New(db *sql.DB, assets fs.FS, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "banco indisponível")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	units.NewHandler(units.NewRepository(db), logger).Register(mux)
	allocations.NewHandler(allocations.NewRepository(db, records.Recalculate), logger).Register(mux)
	records.NewHandler(records.NewRepository(db), logger).Register(mux)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, http.StatusNotFound, "rota não encontrada")
	})

	if assets != nil {
		mux.Handle("/", spa(assets))
	}

	return httpx.Recover(logger)(httpx.Logger(logger)(mux))
}

// spa serve arquivos estáticos e devolve index.html para rotas desconhecidas,
// permitindo roteamento no cliente.
func spa(assets fs.FS) http.Handler {
	files := http.FileServerFS(assets)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			files.ServeHTTP(w, r)
			return
		}
		if _, err := fs.Stat(assets, name); err != nil {
			http.ServeFileFS(w, r, assets, "index.html")
			return
		}
		if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}
