// Package apperr define os erros esperados das regras de negócio.
// A camada HTTP traduz cada tipo no status certo (ver httpx.Fail).
package apperr

import "fmt"

type Kind int

const (
	// Invalid indica dado inválido enviado pelo usuário (400).
	Invalid Kind = iota + 1
	// NotFound indica registro inexistente (404).
	NotFound
	// Conflict indica conflito com dados já salvos (409).
	Conflict
)

type Error struct {
	Kind Kind
	Msg  string
}

func (e *Error) Error() string {
	return e.Msg
}

func New(kind Kind, format string, args ...any) error {
	return &Error{Kind: kind, Msg: fmt.Sprintf(format, args...)}
}
