# Gestão Solar

Gestão de energia solar entre **unidades geradoras** e **unidades consumidoras**, ligadas por um **rateio**. Acompanha o consumo e o banco de kWh de cada unidade, com gráficos.

Frontend em React + Radix Themes, backend em Go (net/http) com SQLite. Em produção, a SPA é embutida no binário Go, gerando um executável único.

## Regras de negócio

1. A geradora usa a própria energia primeiro. Só a sobra vai para as consumidoras.
2. A soma do rateio de uma geradora **nunca passa de 100%**.
3. Uma consumidora recebe de **uma** geradora por vez. Uma geradora pode ter várias consumidoras.
4. O banco de kWh cobre a falta de energia e **nunca fica negativo**.
5. Mudar a porcentagem do rateio cria uma **linha nova** com o mês de início. As linhas antigas formam o histórico e não são editadas.
6. Nomes em inglês no código e no banco. Textos da tela em português.
7. O mês de uma consumidora que recebe energia do rateio **não pode ser apagado**, porque o recálculo o criaria de novo. Para zerar o uso, edite o campo "Saldo utilizado (Consumo faturado kWh)" para 0.

## Telas

| Endereço      | Tela               | O que tem                                                                   |
| ------------- | ------------------ | --------------------------------------------------------------------------- |
| `/`           | Painel             | Total do banco, gráfico, tabela de unidades e modais de cadastro           |
| `/units/{id}` | Página da unidade  | Banco da unidade, meses (adicionar, editar e apagar) e rateio (só leitura) |

Clicar no nome da unidade, no painel, abre a página dela.

### Linha do total no gráfico

O gráfico tem 2 linhas: a da unidade escolhida (cheia) e a do **total de todas as unidades** (tracejada), para ver os dados consolidados. O eixo usa os meses de todas as unidades.

- Energia injetada e saldo utilizado: soma dos valores do mês.
- Saldo atualizado (banco de kWh): soma dos bancos. Se uma unidade não tem registro no mês, entra o último banco dela. Por isso o total do último mês é igual ao card "Total do banco de kWh".
- A soma é feita no servidor (`GET /api/monthly-totals`).

### Todas as unidades numa única visão

No seletor do gráfico, a opção **"Todas as unidades"** mostra uma linha para cada unidade e a linha do total, juntas. Ela já vem escolhida quando a tela abre.

| Linha        | Aparência                                    |
| ------------ | -------------------------------------------- |
| Geradora     | linha grossa, pontos quadrados, tons quentes |
| Consumidora  | linha fina, pontos redondos, tons frios      |
| Total        | linha tracejada cinza                        |

Cada unidade mantém a mesma cor nas duas visões. A diferença entre as linhas não depende só da cor.

### Comparações na caixa de valor

Ao passar o mouse (ou tocar) no gráfico, a caixa de valor mostra o mês apontado. Para cada linha, ela mostra o valor e 2 comparações:

1. **Mês atual x mês anterior:** a variação em kWh e em % (ex.: "▲ +84,00 kWh (+8,8%)"). O mês atual é o mês apontado; o anterior é o mês antes dele no gráfico. Sem valor no mês anterior, aparece "sem dados no mês anterior".
2. **Total x unidade:** a parte da unidade no total (%) e a diferença para o total (total − unidade). Não aparece na linha do próprio total.

A legenda (`LineLegend`) mostra só o desenho, o nome e o tipo de cada linha. As contas ficam em `frontend/src/comparison.ts` e a caixa em `frontend/src/components/ChartTooltip.tsx`.

### Estações do ano no gráfico

O gráfico de linha mostra as estações como faixas coloridas no fundo. Usa o hemisfério sul e 3 meses por estação (divisão da meteorologia):

| Estação   | Meses     | Cor       |
| --------- | --------- | --------- |
| Verão     | dez a fev | amarelo   |
| Outono    | mar a mai | laranja   |
| Inverno   | jun a ago | azul      |
| Primavera | set a nov | verde     |

- Dezembro fica no mesmo verão que janeiro e fevereiro do ano seguinte.
- A informação não depende só da cor: o nome da estação aparece no topo da faixa, na legenda e na caixa de valor (ex.: "04/2026 · Outono"). Em telas estreitas, o nome some da faixa quando não cabe, mas continua na legenda.
- As regras ficam em `frontend/src/seasons.ts`.

### Cálculo de cada mês

A **sobra** do mês é usada no cálculo, mas não é salva nem mostrada.

| Unidade     | Sobra do mês         | Energia rateada                    | Saldo atualizado (Banco de kWh)        |
| ----------- | -------------------- | ---------------------------------- | -------------------------------------- |
| Geradora    | injetada − utilizado | sobra × % de cada consumidora      | anterior + (sobra − rateada), mínimo 0 |
| Consumidora | recebida − utilizado | recebida da geradora               | anterior + sobra, mínimo 0             |

Exemplo: a geradora injeta 1000 kWh e usa 400 kWh. Sobram 600 kWh. Com 30% para B e 50% para C, B recebe 180 kWh, C recebe 300 kWh e 120 kWh vão para o banco da geradora.

Salvar um mês ou criar um rateio recalcula todos os meses, numa única transação. Se uma consumidora está no rateio mas não tem registro no mês, o mês dela é criado com uso 0, para a energia não se perder. O cálculo fica em `backend/internal/energy`.

## Stack

| Camada   | Tecnologia                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Frontend | Vite, React 19, TypeScript, `@radix-ui/themes`, TanStack Query, React Router, Recharts |
| Backend  | Go 1.26, `net/http` (roteamento nativo), `database/sql`                     |
| Banco    | SQLite via `modernc.org/sqlite` (pure Go, sem CGO)                          |
| Schema   | goose, com migrations embutidas e aplicadas no startup                     |
| Testes   | `go test` (unidade e API) e Playwright (e2e)                               |
| Deploy   | Docker multi-stage → imagem distroless com binário único                   |

## Requisitos

- Go 1.26+ (com `GOTOOLCHAIN=auto`, uma versão anterior baixa a 1.26 sozinha)
- Node 22+ e npm
- Docker (opcional)

## Desenvolvimento

Dois terminais:

```sh
make dev-api   # API em http://localhost:8080 (build tag "dev", sem frontend embutido)
make dev-web   # Vite em http://localhost:5173, com proxy de /api para :8080
```

Instale antes as dependências do frontend: `cd frontend && npm install`.

## Build

```sh
make build          # frontend → backend/web/dist → bin/gestao-solar
./bin/gestao-solar  # serve API + SPA em http://localhost:8080
```

### Por que a build tag `dev`?

`backend/web/embed.go` usa `//go:embed all:dist`, que falha se `backend/web/dist` não existir. Sem o build do frontend, use `-tags dev` (`make dev-api`, `make test` e `make lint` já fazem isso). Nesse modo, o Go serve apenas a API.

## Configuração

| Variável  | Padrão          | Descrição                  |
| --------- | --------------- | -------------------------- |
| `PORT`    | `8080`          | Porta HTTP                 |
| `DB_PATH` | `./data/app.db` | Caminho do arquivo SQLite  |

## Migrations

Arquivos SQL em `backend/internal/database/migrations`, aplicados automaticamente quando o servidor sobe.

```sh
make migrate-new name=cria_usinas   # gera 0000N_cria_usinas.sql
```

## Testes

```sh
make test   # go test (SQLite em memória) + typecheck do frontend
make lint   # go vet + oxlint
```

### Testes E2E

Os testes ficam em `frontend/e2e` e usam o Playwright com Chromium.

```sh
make e2e-install   # instala o Chromium (só na primeira vez)
make e2e           # roda os testes e2e
```

- O Playwright faz o build do frontend e sobe o binário Go na porta **8081**, com `DB_PATH=:memory:`. O banco de desenvolvimento nunca é usado.
- Os testes rodam um por vez (`workers: 1`), porque o total do banco de kWh soma todas as unidades.
- Cada teste cria os próprios dados pela API, com nomes únicos.
- O navegador usa `pt-BR` e o fuso `America/Sao_Paulo`.
- O `make test` não roda os testes e2e.

## Docker

```sh
docker compose up --build   # http://localhost:8080, banco no volume "app-data"
```

## API

| Método | Rota                                 | Descrição                                        |
| ------ | ------------------------------------ | ------------------------------------------------ |
| GET    | `/api/health`                        | Status + ping no banco                           |
| GET    | `/api/units`                         | Lista as unidades (geradoras primeiro)           |
| POST   | `/api/units`                         | Cria unidade                                     |
| GET    | `/api/units/{id}`                    | Busca unidade                                    |
| PUT    | `/api/units/{id}`                    | Muda o nome (o tipo não muda)                    |
| DELETE | `/api/units/{id}`                    | Apaga unidade sem histórico (com histórico: 409) |
| GET    | `/api/allocations?generatorUnitId=1` | Histórico de rateio (o filtro é opcional)        |
| POST   | `/api/allocations`                   | Nova linha de rateio                             |
| GET    | `/api/monthly-records?unitId=1`      | Meses da unidade, do mais antigo ao mais novo    |
| PUT    | `/api/monthly-records`               | Cria ou substitui o mês e recalcula              |
| DELETE | `/api/monthly-records/{id}`          | Apaga o mês e recalcula (409 se recebe rateio)   |
| GET    | `/api/summary`                       | Saldo atualizado de cada unidade e o total       |
| GET    | `/api/monthly-totals`                | Soma de todas as unidades em cada mês            |

Corpos:

- Unidade: `{"name": "Casa", "type": "generator"}` (ou `"consumer"`). Na edição, só `{"name"}`.
- Rateio: `{"generatorUnitId": 1, "consumerUnitId": 2, "percentage": 30, "startMonth": "2026-01"}`
- Mês: `{"unitId": 1, "referenceMonth": "2026-01", "injectedEnergyKwh": 1000, "usedBalanceKwh": 400}` (consumidora usa `injectedEnergyKwh: 0`)

Meses usam o formato `AAAA-MM`. Os erros seguem o formato `{"error": "mensagem"}`: 400 para dado inválido (inclusive rateio acima de 100%), 404 para registro inexistente e 409 para conflito.

## Estrutura

```
backend/
  cmd/server/            entrypoint, graceful shutdown
  internal/config/       variáveis de ambiente
  internal/database/     conexão SQLite + migrations (goose)
  internal/httpx/        helpers JSON, erros e middlewares
  internal/apperr/       erros de negócio (400, 404, 409)
  internal/month/        tipo Month (AAAA-MM)
  internal/energy/       cálculo do rateio e do banco de kWh (sem banco de dados)
  internal/units/        unidades (model, repository, handler)
  internal/allocations/  rateio com histórico e limite de 100%
  internal/records/      valores do mês, recálculo e resumo do banco
  internal/server/       montagem das rotas + fallback da SPA
  web/                   embed do build do frontend
frontend/
  src/api/               cliente HTTP e hooks do TanStack Query
  src/components/        componentes (modais, gráfico, tabela)
  src/pages/             DashboardPage (/) e UnitDetailPage (/units/{id})
  e2e/                   testes e2e com Playwright
```
