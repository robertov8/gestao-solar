package units

import (
	"log/slog"
	"net/http"

	"gestao-solar/backend/internal/httpx"
)

type Handler struct {
	repo   *Repository
	logger *slog.Logger
}

func NewHandler(repo *Repository, logger *slog.Logger) *Handler {
	return &Handler{repo: repo, logger: logger}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/units", h.list)
	mux.HandleFunc("POST /api/units", h.create)
	mux.HandleFunc("GET /api/units/{id}", h.get)
	mux.HandleFunc("PUT /api/units/{id}", h.update)
	mux.HandleFunc("DELETE /api/units/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context())
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	u, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if !httpx.DecodeValid(w, r, &in) {
		return
	}
	u, err := h.repo.Create(r.Context(), in)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, u)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	var in UpdateInput
	if !httpx.DecodeValid(w, r, &in) {
		return
	}
	u, err := h.repo.Update(r.Context(), id, in)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
