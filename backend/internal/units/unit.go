package units

import (
	"errors"
	"strings"
	"time"
)

type Type string

const (
	Generator Type = "generator"
	Consumer  Type = "consumer"
)

// Label devolve o nome do tipo para mensagens ao usuário.
func (t Type) Label() string {
	if t == Generator {
		return "geradora"
	}
	return "consumidora"
}

type Unit struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      Type      `json:"type"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateInput é o corpo de criação. O tipo não pode mudar depois.
type CreateInput struct {
	Name string `json:"name"`
	Type Type   `json:"type"`
}

func (in *CreateInput) Normalize() error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return errNameRequired
	}
	if in.Type != Generator && in.Type != Consumer {
		return errors.New("tipo deve ser generator ou consumer")
	}
	return nil
}

// UpdateInput é o corpo de edição: só o nome pode mudar.
type UpdateInput struct {
	Name string `json:"name"`
}

func (in *UpdateInput) Normalize() error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return errNameRequired
	}
	return nil
}

var errNameRequired = errors.New("nome é obrigatório")
