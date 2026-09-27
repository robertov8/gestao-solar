package allocations

import (
	"errors"
	"time"

	"gestao-solar/backend/internal/month"
)

// Allocation é uma linha do histórico de rateio. Uma mudança de porcentagem
// cria uma linha nova; as antigas não são editadas.
type Allocation struct {
	ID              int64       `json:"id"`
	GeneratorUnitID int64       `json:"generatorUnitId"`
	ConsumerUnitID  int64       `json:"consumerUnitId"`
	Percentage      int         `json:"percentage"`
	StartMonth      month.Month `json:"startMonth"`
	CreatedAt       time.Time   `json:"createdAt"`
	UpdatedAt       time.Time   `json:"updatedAt"`
}

type Input struct {
	GeneratorUnitID int64       `json:"generatorUnitId"`
	ConsumerUnitID  int64       `json:"consumerUnitId"`
	Percentage      int         `json:"percentage"`
	StartMonth      month.Month `json:"startMonth"`
}

func (in *Input) Normalize() error {
	switch {
	case in.GeneratorUnitID <= 0:
		return errors.New("unidade geradora é obrigatória")
	case in.ConsumerUnitID <= 0:
		return errors.New("unidade consumidora é obrigatória")
	case in.GeneratorUnitID == in.ConsumerUnitID:
		return errors.New("a geradora e a consumidora devem ser unidades diferentes")
	case in.Percentage < 0 || in.Percentage > 100:
		return errors.New("a porcentagem deve ficar entre 0 e 100")
	case in.StartMonth.IsZero():
		return errors.New("mês de início é obrigatório")
	}
	return nil
}
