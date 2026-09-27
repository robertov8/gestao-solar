-- +goose Up
CREATE TABLE clientes (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    nome       TEXT     NOT NULL,
    email      TEXT     NOT NULL DEFAULT '',
    telefone   TEXT     NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE clientes;
