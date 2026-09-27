package records

import (
	"context"
	"database/sql"
	"errors"
	"math"

	"gestao-solar/backend/internal/allocations"
	"gestao-solar/backend/internal/apperr"
	"gestao-solar/backend/internal/energy"
	"gestao-solar/backend/internal/month"
	"gestao-solar/backend/internal/units"
)

var (
	ErrNotFound         = apperr.New(apperr.NotFound, "mês não encontrado")
	errUnitNotFound     = apperr.New(apperr.Invalid, "unidade não encontrada")
	errConsumerInjected = apperr.New(apperr.Invalid, "unidade consumidora não tem energia injetada")
	errReceivesEnergy   = apperr.New(apperr.Conflict,
		"este mês não pode ser apagado: a consumidora recebe energia do rateio nele. "+
			`Para zerar o uso, edite o campo "Saldo utilizado (Consumo faturado kWh)" para 0`)
)

const columns = `id, unit_id, reference_month, injected_energy_kwh, used_balance_kwh,
	allocated_energy_kwh, updated_balance_kwh, created_at, updated_at`

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type scanner interface {
	Scan(dest ...any) error
}

func scan(s scanner) (Record, error) {
	var rec Record
	err := s.Scan(&rec.ID, &rec.UnitID, &rec.ReferenceMonth, &rec.InjectedEnergyKwh, &rec.UsedBalanceKwh,
		&rec.AllocatedEnergyKwh, &rec.UpdatedBalanceKwh, &rec.CreatedAt, &rec.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return rec, ErrNotFound
	}
	return rec, err
}

// ListByUnit devolve os meses da unidade, do mais antigo para o mais novo.
func (r *Repository) ListByUnit(ctx context.Context, unitID int64) ([]Record, error) {
	rows, err := r.db.QueryContext(ctx,
		"SELECT "+columns+" FROM monthly_records WHERE unit_id = ? ORDER BY reference_month", unitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Record{}
	for rows.Next() {
		rec, err := scan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, rec)
	}
	return list, rows.Err()
}

// Save cria ou substitui o mês da unidade e recalcula todos os meses.
func (r *Repository) Save(ctx context.Context, in Input) (Record, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Record{}, err
	}
	defer tx.Rollback()

	var unitType units.Type
	err = tx.QueryRowContext(ctx, "SELECT type FROM units WHERE id = ?", in.UnitID).Scan(&unitType)
	if errors.Is(err, sql.ErrNoRows) {
		return Record{}, errUnitNotFound
	}
	if err != nil {
		return Record{}, err
	}
	if unitType == units.Consumer && in.InjectedEnergyKwh != 0 {
		return Record{}, errConsumerInjected
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO monthly_records (unit_id, reference_month, injected_energy_kwh, used_balance_kwh)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (unit_id, reference_month) DO UPDATE SET
			injected_energy_kwh = excluded.injected_energy_kwh,
			used_balance_kwh    = excluded.used_balance_kwh,
			updated_at          = CURRENT_TIMESTAMP`,
		in.UnitID, in.ReferenceMonth, in.InjectedEnergyKwh, in.UsedBalanceKwh,
	)
	if err != nil {
		return Record{}, err
	}
	if err := Recalculate(ctx, tx); err != nil {
		return Record{}, err
	}

	rec, err := scan(tx.QueryRowContext(ctx,
		"SELECT "+columns+" FROM monthly_records WHERE unit_id = ? AND reference_month = ?",
		in.UnitID, in.ReferenceMonth,
	))
	if err != nil {
		return Record{}, err
	}
	return rec, tx.Commit()
}

// Delete apaga o mês e recalcula todos os meses.
// Se a consumidora recebe energia do rateio nesse mês, o recálculo criaria
// o mês de novo; nesse caso o pedido é recusado e nada muda.
func (r *Repository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var unitID int64
	var m month.Month
	err = tx.QueryRowContext(ctx,
		"DELETE FROM monthly_records WHERE id = ? RETURNING unit_id, reference_month", id,
	).Scan(&unitID, &m)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := Recalculate(ctx, tx); err != nil {
		return err
	}

	var recreated bool
	err = tx.QueryRowContext(ctx,
		"SELECT EXISTS (SELECT 1 FROM monthly_records WHERE unit_id = ? AND reference_month = ?)", unitID, m,
	).Scan(&recreated)
	if err != nil {
		return err
	}
	if recreated {
		return errReceivesEnergy
	}
	return tx.Commit()
}

// Summary devolve o banco de kWh atual de cada unidade e o total.
func (r *Repository) Summary(ctx context.Context) (Summary, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.id, COALESCE((
			SELECT r.updated_balance_kwh FROM monthly_records r
			WHERE r.unit_id = u.id
			ORDER BY r.reference_month DESC
			LIMIT 1
		), 0)
		FROM units u
		ORDER BY u.id`)
	if err != nil {
		return Summary{}, err
	}
	defer rows.Close()

	s := Summary{Units: []UnitBalance{}}
	for rows.Next() {
		var b UnitBalance
		if err := rows.Scan(&b.UnitID, &b.BalanceKwh); err != nil {
			return Summary{}, err
		}
		s.Units = append(s.Units, b)
		s.TotalBalanceKwh += b.BalanceKwh
	}
	s.TotalBalanceKwh = roundKwh(s.TotalBalanceKwh)
	return s, rows.Err()
}

// Totals soma todas as unidades em cada mês, do mais antigo para o mais novo.
func (r *Repository) Totals(ctx context.Context) ([]MonthlyTotal, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT unit_id, reference_month, injected_energy_kwh,
			used_balance_kwh, updated_balance_kwh
		FROM monthly_records
		ORDER BY reference_month`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	totals := []MonthlyTotal{}
	// O banco de cada unidade continua valendo nos meses sem registro:
	// bank guarda a soma dos últimos bancos e muda só pela diferença.
	balances := map[int64]float64{}
	bank := 0.0
	for rows.Next() {
		var unitID int64
		var m month.Month
		var injected, used, balance float64
		if err := rows.Scan(&unitID, &m, &injected, &used, &balance); err != nil {
			return nil, err
		}
		if len(totals) == 0 || totals[len(totals)-1].ReferenceMonth != m {
			totals = append(totals, MonthlyTotal{ReferenceMonth: m})
		}
		t := &totals[len(totals)-1]
		t.InjectedEnergyKwh += injected
		t.UsedBalanceKwh += used
		bank += balance - balances[unitID]
		balances[unitID] = balance
		t.UpdatedBalanceKwh = bank
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range totals {
		totals[i].InjectedEnergyKwh = roundKwh(totals[i].InjectedEnergyKwh)
		totals[i].UsedBalanceKwh = roundKwh(totals[i].UsedBalanceKwh)
		totals[i].UpdatedBalanceKwh = roundKwh(totals[i].UpdatedBalanceKwh)
	}
	return totals, nil
}

// roundKwh arredonda para 3 casas (Wh), como o cálculo.
func roundKwh(v float64) float64 {
	return math.Round(v*1000) / 1000
}

// Recalculate refaz o cálculo de todos os meses dentro de tx.
// Só as linhas com valores novos são gravadas; as outras mantêm o updated_at.
func Recalculate(ctx context.Context, tx *sql.Tx) error {
	types, err := loadUnitTypes(ctx, tx)
	if err != nil {
		return err
	}
	entries, err := loadEntries(ctx, tx)
	if err != nil {
		return err
	}
	allocs, err := allocations.LoadAll(ctx, tx)
	if err != nil {
		return err
	}

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO monthly_records
			(unit_id, reference_month, allocated_energy_kwh, updated_balance_kwh)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (unit_id, reference_month) DO UPDATE SET
			allocated_energy_kwh = excluded.allocated_energy_kwh,
			updated_balance_kwh  = excluded.updated_balance_kwh,
			updated_at           = CURRENT_TIMESTAMP
		WHERE allocated_energy_kwh IS NOT excluded.allocated_energy_kwh
			OR updated_balance_kwh IS NOT excluded.updated_balance_kwh`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, res := range energy.Calculate(types, entries, allocs) {
		_, err := stmt.ExecContext(ctx, res.UnitID, res.Month, res.Allocated, res.UpdatedBalance)
		if err != nil {
			return err
		}
	}
	return nil
}

func loadUnitTypes(ctx context.Context, tx *sql.Tx) (map[int64]units.Type, error) {
	rows, err := tx.QueryContext(ctx, "SELECT id, type FROM units")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	types := map[int64]units.Type{}
	for rows.Next() {
		var id int64
		var t units.Type
		if err := rows.Scan(&id, &t); err != nil {
			return nil, err
		}
		types[id] = t
	}
	return types, rows.Err()
}

func loadEntries(ctx context.Context, tx *sql.Tx) ([]energy.Entry, error) {
	rows, err := tx.QueryContext(ctx,
		"SELECT unit_id, reference_month, injected_energy_kwh, used_balance_kwh FROM monthly_records")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []energy.Entry
	for rows.Next() {
		var e energy.Entry
		if err := rows.Scan(&e.UnitID, &e.Month, &e.Injected, &e.Used); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}
