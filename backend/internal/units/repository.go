package units

import (
	"context"
	"database/sql"
	"errors"

	"gestao-solar/backend/internal/apperr"
)

var (
	ErrNotFound   = apperr.New(apperr.NotFound, "unidade não encontrada")
	ErrHasHistory = apperr.New(apperr.Conflict, "a unidade tem histórico (meses ou rateio) e não pode ser apagada")
)

const columns = "id, name, type, created_at, updated_at"

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type scanner interface {
	Scan(dest ...any) error
}

func scan(s scanner) (Unit, error) {
	var u Unit
	err := s.Scan(&u.ID, &u.Name, &u.Type, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

// List devolve as geradoras primeiro e depois as consumidoras, cada grupo por nome.
func (r *Repository) List(ctx context.Context) ([]Unit, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT "+columns+` FROM units
		ORDER BY CASE type WHEN 'generator' THEN 0 ELSE 1 END, name COLLATE NOCASE`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Unit{}
	for rows.Next() {
		u, err := scan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id int64) (Unit, error) {
	return scan(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM units WHERE id = ?", id))
}

func (r *Repository) Create(ctx context.Context, in CreateInput) (Unit, error) {
	return scan(r.db.QueryRowContext(ctx,
		"INSERT INTO units (name, type) VALUES (?, ?) RETURNING "+columns,
		in.Name, in.Type,
	))
}

func (r *Repository) Update(ctx context.Context, id int64, in UpdateInput) (Unit, error) {
	return scan(r.db.QueryRowContext(ctx,
		`UPDATE units SET name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
		RETURNING `+columns,
		in.Name, id,
	))
}

// Delete só apaga unidades sem histórico, para não mudar o banco de kWh de outras unidades.
func (r *Repository) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM units
		WHERE id = ?1
		AND NOT EXISTS (SELECT 1 FROM monthly_records WHERE unit_id = ?1)
		AND NOT EXISTS (SELECT 1 FROM allocations WHERE generator_unit_id = ?1 OR consumer_unit_id = ?1)`,
		id,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	if _, err := r.Get(ctx, id); err != nil {
		return err
	}
	return ErrHasHistory
}
