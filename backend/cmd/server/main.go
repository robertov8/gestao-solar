package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gestao-solar/backend/internal/config"
	"gestao-solar/backend/internal/database"
	"gestao-solar/backend/internal/server"
	"gestao-solar/backend/web"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("servidor encerrado com erro", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DBPath)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := database.Migrate(ctx, db); err != nil {
		return err
	}

	assets := web.Assets()
	if assets == nil {
		logger.Info("frontend não embutido (build dev); use o Vite em http://localhost:5173")
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.New(db, assets, logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("servidor ouvindo", "addr", srv.Addr, "db", cfg.DBPath)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
	}

	logger.Info("encerrando servidor")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
