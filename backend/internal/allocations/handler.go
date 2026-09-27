package allocations

import (
	"log/slog"
	"net/http"
	"strconv"

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
	mux.HandleFunc("GET /api/allocations", h.list)
	mux.HandleFunc("POST /api/allocations", h.create)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	var generatorID int64
	if v := r.URL.Query().Get("generatorUnitId"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "generatorUnitId inválido")
			return
		}
		generatorID = id
	}
	list, err := h.repo.List(r.Context(), generatorID)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !httpx.DecodeValid(w, r, &in) {
		return
	}
	a, err := h.repo.Create(r.Context(), in)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, a)
}
