package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open abre o banco SQLite em path (use ":memory:" para testes).
func Open(ctx context.Context, path string) (*sql.DB, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("criar diretório do banco: %w", err)
		}
	}

	q := url.Values{}
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "synchronous(NORMAL)")
	q.Add("_pragma", "busy_timeout(5000)")

	db, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, fmt.Errorf("abrir banco: %w", err)
	}
	// SQLite aceita um único escritor; uma conexão evita SQLITE_BUSY
	// e mantém o mesmo banco quando path é ":memory:".
	db.SetMaxOpenConns(1)

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("conectar ao banco: %w", err)
	}
	return db, nil
}

// Migrate aplica as migrations pendentes embutidas no binário.
func Migrate(ctx context.Context, db *sql.DB) error {
	fsys, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, db, fsys)
	if err != nil {
		return fmt.Errorf("criar provider de migrations: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("aplicar migrations: %w", err)
	}
	return nil
}
