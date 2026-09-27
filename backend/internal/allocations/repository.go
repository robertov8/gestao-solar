package allocations

import (
	"context"
	"database/sql"
	"errors"

	"gestao-solar/backend/internal/apperr"
	"gestao-solar/backend/internal/energy"
	"gestao-solar/backend/internal/units"
)

var ErrDuplicate = apperr.New(apperr.Conflict, "essa consumidora já tem um rateio começando nesse mês")

const columns = "id, generator_unit_id, consumer_unit_id, percentage, start_month, created_at, updated_at"

// Recalculator refaz o cálculo dos meses depois de uma mudança no rateio.
type Recalculator func(ctx context.Context, tx *sql.Tx) error

type Repository struct {
	db          *sql.DB
	recalculate Recalculator
}

func NewRepository(db *sql.DB, recalculate Recalculator) *Repository {
	return &Repository{db: db, recalculate: recalculate}
}

type scanner interface {
	Scan(dest ...any) error
}

func scan(s scanner) (Allocation, error) {
	var a Allocation
	err := s.Scan(&a.ID, &a.GeneratorUnitID, &a.ConsumerUnitID, &a.Percentage, &a.StartMonth, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

// List devolve o histórico, do mais novo para o mais antigo.
// Com generatorID > 0, devolve só as linhas dessa geradora.
func (r *Repository) List(ctx context.Context, generatorID int64) ([]Allocation, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT "+columns+` FROM allocations
		WHERE ?1 = 0 OR generator_unit_id = ?1
		ORDER BY start_month DESC, id DESC`,
		generatorID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Allocation{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// Create grava uma linha nova no histórico e recalcula os meses.
// Recusa a linha se a soma do rateio da geradora passar de 100% em algum mês.
func (r *Repository) Create(ctx context.Context, in Input) (Allocation, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Allocation{}, err
	}
	defer tx.Rollback()

	if err := checkType(ctx, tx, in.GeneratorUnitID, units.Generator); err != nil {
		return Allocation{}, err
	}
	if err := checkType(ctx, tx, in.ConsumerUnitID, units.Consumer); err != nil {
		return Allocation{}, err
	}

	all, err := LoadAll(ctx, tx)
	if err != nil {
		return Allocation{}, err
	}
	for _, a := range all {
		if a.ConsumerID == in.ConsumerUnitID && a.StartMonth == in.StartMonth {
			return Allocation{}, ErrDuplicate
		}
	}
	all = append(all, energy.Allocation{
		GeneratorID: in.GeneratorUnitID,
		ConsumerID:  in.ConsumerUnitID,
		Percentage:  in.Percentage,
		StartMonth:  in.StartMonth,
	})
	if m, total, over := energy.ExceedsLimit(all, in.GeneratorUnitID, in.StartMonth); over {
		return Allocation{}, apperr.New(apperr.Invalid,
			"a soma do rateio da geradora passa de 100%% (ficaria %d%% em %s)", total, m.Label())
	}

	a, err := scan(tx.QueryRowContext(ctx,
		`INSERT INTO allocations (generator_unit_id, consumer_unit_id, percentage, start_month)
		VALUES (?, ?, ?, ?)
		RETURNING `+columns,
		in.GeneratorUnitID, in.ConsumerUnitID, in.Percentage, in.StartMonth,
	))
	if err != nil {
		return Allocation{}, err
	}
	if err := r.recalculate(ctx, tx); err != nil {
		return Allocation{}, err
	}
	return a, tx.Commit()
}

// LoadAll lê todo o histórico de rateio no formato usado pelo cálculo.
func LoadAll(ctx context.Context, tx *sql.Tx) ([]energy.Allocation, error) {
	rows, err := tx.QueryContext(ctx,
		"SELECT generator_unit_id, consumer_unit_id, percentage, start_month FROM allocations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []energy.Allocation
	for rows.Next() {
		var a energy.Allocation
		if err := rows.Scan(&a.GeneratorID, &a.ConsumerID, &a.Percentage, &a.StartMonth); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func checkType(ctx context.Context, tx *sql.Tx, id int64, want units.Type) error {
	var got units.Type
	err := tx.QueryRowContext(ctx, "SELECT type FROM units WHERE id = ?", id).Scan(&got)
	if errors.Is(err, sql.ErrNoRows) {
		return apperr.New(apperr.Invalid, "unidade %s não encontrada", want.Label())
	}
	if err != nil {
		return err
	}
	if got != want {
		return apperr.New(apperr.Invalid, "a unidade escolhida não é %s", want.Label())
	}
	return nil
}
