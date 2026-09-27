-- +goose Up
ALTER TABLE monthly_records DROP COLUMN remaining_energy_kwh;

-- +goose Down
-- O valor era calculado; volta como 0 até o próximo recálculo.
ALTER TABLE monthly_records ADD COLUMN remaining_energy_kwh REAL NOT NULL DEFAULT 0;
