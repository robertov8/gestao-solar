package records

import (
	"errors"
	"time"

	"gestao-solar/backend/internal/month"
)

// Record é o mês de uma unidade. Os campos allocated e updated balance
// são calculados pelo sistema (ver energy.Calculate).
type Record struct {
	ID                 int64       `json:"id"`
	UnitID             int64       `json:"unitId"`
	ReferenceMonth     month.Month `json:"referenceMonth"`
	InjectedEnergyKwh  float64     `json:"injectedEnergyKwh"`
	UsedBalanceKwh     float64     `json:"usedBalanceKwh"`
	AllocatedEnergyKwh float64     `json:"allocatedEnergyKwh"`
	UpdatedBalanceKwh  float64     `json:"updatedBalanceKwh"`
	CreatedAt          time.Time   `json:"createdAt"`
	UpdatedAt          time.Time   `json:"updatedAt"`
}

// Input é o que o usuário informa. Se o mês já existe, os valores são substituídos.
type Input struct {
	UnitID            int64       `json:"unitId"`
	ReferenceMonth    month.Month `json:"referenceMonth"`
	InjectedEnergyKwh float64     `json:"injectedEnergyKwh"`
	UsedBalanceKwh    float64     `json:"usedBalanceKwh"`
}

func (in *Input) Normalize() error {
	switch {
	case in.UnitID <= 0:
		return errors.New("unidade é obrigatória")
	case in.ReferenceMonth.IsZero():
		return errors.New("mês é obrigatório")
	case in.InjectedEnergyKwh < 0 || in.UsedBalanceKwh < 0:
		return errors.New("os valores não podem ser negativos")
	}
	return nil
}

// MonthlyTotal soma todas as unidades num mês.
// No banco de kWh, a unidade sem registro no mês entra com o último banco dela.
type MonthlyTotal struct {
	ReferenceMonth    month.Month `json:"referenceMonth"`
	InjectedEnergyKwh float64     `json:"injectedEnergyKwh"`
	UsedBalanceKwh    float64     `json:"usedBalanceKwh"`
	UpdatedBalanceKwh float64     `json:"updatedBalanceKwh"`
}

// UnitBalance é o banco de kWh atual da unidade: o do mês mais recente.
type UnitBalance struct {
	UnitID     int64   `json:"unitId"`
	BalanceKwh float64 `json:"balanceKwh"`
}

type Summary struct {
	TotalBalanceKwh float64       `json:"totalBalanceKwh"`
	Units           []UnitBalance `json:"units"`
}
