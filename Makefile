.PHONY: help setup dev build test lint db-reset backup restore

help: ## Muestra esta ayuda
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Setup inicial: instala dependencias y levanta Docker
	./scripts/setup.sh

dev: ## Levanta todo el stack en modo desarrollo (Docker + API + Web)
	docker compose up -d postgres redis minio mailhog
	pnpm dev

build: ## Construye las aplicaciones (API y Web)
	pnpm build

test: ## Ejecuta todos los tests
	pnpm test

lint: ## Ejecuta el linter en todo el monorepo
	pnpm lint

db-reset: ## Resetea la base de datos (¡BORRA DATOS!)
	pnpm --filter @nexos/api db:reset

backup: ## Crea un backup de la base de datos local
	./scripts/backup.sh

restore: ## Restaura la base de datos desde un backup (uso: make restore FILE=./backups/xxx.sql.gz)
	@if [ -z "$(FILE)" ]; then echo "❌ Error: Especifica el archivo con FILE=./backups/xxx.sql.gz"; exit 1; fi
	./scripts/restore.sh $(FILE)
