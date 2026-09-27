GOOSE_VERSION := v3.28.0
MIGRATIONS_DIR := internal/database/migrations

.PHONY: dev-api dev-web build build-web build-api test e2e e2e-install lint migrate-new docker-up clean

dev-api: ## API em modo dev (sem frontend embutido)
	cd backend && go run -tags dev ./cmd/server

dev-web: ## Vite dev server com proxy /api -> :8080
	cd frontend && npm run dev

build: build-web build-api ## Binário único com a SPA embutida em bin/gestao-solar

build-web:
	cd frontend && npm ci && npm run build

build-api:
	cd backend && CGO_ENABLED=0 go build -trimpath -o ../bin/gestao-solar ./cmd/server

test: ## Testes do backend + typecheck do frontend
	cd backend && go test -tags dev ./...
	cd frontend && npx tsc -b

e2e-install: ## Instala o Chromium usado pelos testes e2e (só na primeira vez)
	cd frontend && npx playwright install chromium

e2e: ## Testes e2e com Playwright (servidor na porta 8081, banco em memória)
	cd frontend && npx playwright test

lint:
	cd backend && go vet -tags dev ./...
	cd frontend && npm run lint

migrate-new: ## Cria migration: make migrate-new name=descricao
	@test -n "$(name)" || (echo "uso: make migrate-new name=descricao" && exit 1)
	cd backend && go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir $(MIGRATIONS_DIR) -s create $(name) sql

docker-up:
	docker compose up --build

clean:
	rm -rf bin backend/web/dist
