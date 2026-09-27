-- +goose Up
DROP TABLE IF EXISTS clientes;

CREATE TABLE units (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL,
    type       TEXT     NOT NULL CHECK (type IN ('generator', 'consumer')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_records (
    id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
    unit_id              INTEGER  NOT NULL REFERENCES units(id),
    reference_month      DATETIME NOT NULL,
    injected_energy_kwh  REAL     NOT NULL DEFAULT 0 CHECK (injected_energy_kwh >= 0),
    used_balance_kwh     REAL     NOT NULL DEFAULT 0 CHECK (used_balance_kwh >= 0),
    remaining_energy_kwh REAL     NOT NULL DEFAULT 0,
    allocated_energy_kwh REAL     NOT NULL DEFAULT 0,
    updated_balance_kwh  REAL     NOT NULL DEFAULT 0 CHECK (updated_balance_kwh >= 0),
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (unit_id, reference_month)
);

CREATE TABLE allocations (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    generator_unit_id INTEGER  NOT NULL REFERENCES units(id),
    consumer_unit_id  INTEGER  NOT NULL REFERENCES units(id),
    percentage        INTEGER  NOT NULL CHECK (percentage BETWEEN 0 AND 100),
    start_month       DATETIME NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (consumer_unit_id, start_month)
);

CREATE INDEX allocations_generator_idx ON allocations (generator_unit_id, start_month);

-- +goose Down
DROP TABLE allocations;
DROP TABLE monthly_records;
DROP TABLE units;

CREATE TABLE clientes (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    nome       TEXT     NOT NULL,
    email      TEXT     NOT NULL DEFAULT '',
    telefone   TEXT     NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
