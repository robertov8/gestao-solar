package records

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
	mux.HandleFunc("GET /api/monthly-records", h.list)
	mux.HandleFunc("PUT /api/monthly-records", h.save)
	mux.HandleFunc("DELETE /api/monthly-records/{id}", h.delete)
	mux.HandleFunc("GET /api/summary", h.summary)
	mux.HandleFunc("GET /api/monthly-totals", h.totals)
}

func (h *Handler) totals(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.Totals(r.Context())
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	unitID, err := strconv.ParseInt(r.URL.Query().Get("unitId"), 10, 64)
	if err != nil || unitID <= 0 {
		httpx.Error(w, http.StatusBadRequest, "unitId é obrigatório")
		return
	}
	list, err := h.repo.ListByUnit(r.Context(), unitID)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !httpx.DecodeValid(w, r, &in) {
		return
	}
	rec, err := h.repo.Save(r.Context(), in)
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rec)
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

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.Summary(r.Context())
	if err != nil {
		httpx.Fail(w, r, h.logger, err)
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}
