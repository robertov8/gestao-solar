package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"gestao-solar/backend/internal/apperr"
)

const maxBodyBytes = 1 << 20

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func Error(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, map[string]string{"error": msg})
}

// Decode lê o corpo JSON em v, rejeitando campos desconhecidos e corpos grandes.
func Decode(w http.ResponseWriter, r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("corpo da requisição vazio")
		}
		return fmt.Errorf("JSON inválido: %w", err)
	}
	return nil
}

// DecodeValid lê o corpo JSON em v e chama v.Normalize. Em caso de erro, responde 400.
func DecodeValid(w http.ResponseWriter, r *http.Request, v interface{ Normalize() error }) bool {
	if err := Decode(w, r, v); err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return false
	}
	if err := v.Normalize(); err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}

// PathID lê o {id} da rota. Se for inválido, responde 400.
func PathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		Error(w, http.StatusBadRequest, "id inválido")
		return 0, false
	}
	return id, true
}

// Fail responde com o status do apperr.Error. Outros erros viram 500 e vão para o log.
func Fail(w http.ResponseWriter, r *http.Request, logger *slog.Logger, err error) {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		Error(w, statusOf(appErr.Kind), appErr.Msg)
		return
	}
	logger.Error("erro interno", "err", err, "method", r.Method, "path", r.URL.Path)
	Error(w, http.StatusInternalServerError, "erro interno")
}

func statusOf(kind apperr.Kind) int {
	switch kind {
	case apperr.Invalid:
		return http.StatusBadRequest
	case apperr.NotFound:
		return http.StatusNotFound
	case apperr.Conflict:
		return http.StatusConflict
	}
	return http.StatusInternalServerError
}
