FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# vite.config.ts grava o build em ../backend/web/dist
RUN npm run build

FROM golang:1.26-alpine AS api
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=web /src/backend/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gestao-solar ./cmd/server \
    && mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=api /out/gestao-solar /gestao-solar
# Diretório criado com dono nonroot para o volume nomeado herdar a permissão.
COPY --from=api --chown=nonroot:nonroot /out/data /data
ENV PORT=8080 \
    DB_PATH=/data/app.db
VOLUME /data
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/gestao-solar"]
