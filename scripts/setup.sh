#!/bin/bash
# scripts/setup.sh
# Setup inicial de Nexos ERP en una máquina nueva.
# Ejecutar una sola vez después de clonar el repositorio.
#
# Uso: ./scripts/setup.sh

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}🚀 Nexos ERP — Setup Inicial${NC}"
echo "   =============================="
echo ""

# ─── Verificar requisitos ────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}❌ '$1' no encontrado. Instálalo antes de continuar.${NC}"
    return 1
  fi
  echo -e "${GREEN}✅ $1 $(${1} --version 2>&1 | head -1)${NC}"
}

echo -e "${BOLD}Verificando dependencias...${NC}"
check_cmd node
check_cmd pnpm
check_cmd docker
echo ""

# ─── Configurar variables de entorno ─────────────────────────────────────────
if [ -f ".env" ]; then
  echo -e "${YELLOW}⚠️  El archivo .env ya existe. Se omite la copia.${NC}"
else
  cp .env.example .env
  echo -e "${GREEN}✅ Archivo .env creado desde .env.example${NC}"
  echo -e "${YELLOW}   👉 Edita .env y genera tus JWT secrets:${NC}"
  echo "      JWT_ACCESS_SECRET=\$(openssl rand -base64 32)"
  echo "      JWT_REFRESH_SECRET=\$(openssl rand -base64 32)"
fi
echo ""

# ─── Instalar dependencias ────────────────────────────────────────────────────
echo -e "${BOLD}Instalando dependencias del monorepo...${NC}"
pnpm install
echo -e "${GREEN}✅ Dependencias instaladas${NC}"
echo ""

# ─── Configurar Husky ────────────────────────────────────────────────────────
echo -e "${BOLD}Configurando Husky (pre-commit hooks)...${NC}"
pnpm exec husky || true
echo -e "${GREEN}✅ Husky configurado${NC}"
echo ""

# ─── Crear directorios necesarios ────────────────────────────────────────────
mkdir -p backups
echo -e "${GREEN}✅ Directorio ./backups creado${NC}"
echo ""

# ─── Levantar Docker ─────────────────────────────────────────────────────────
echo -e "${BOLD}Levantando infraestructura Docker...${NC}"
echo "   (PostgreSQL, Redis, MinIO, Mailhog)"
docker compose up -d postgres redis minio mailhog

echo ""
echo "   Esperando a que los servicios estén healthy..."
sleep 5
docker compose ps

echo ""
echo -e "${GREEN}${BOLD}🎉 Setup completado!${NC}"
echo ""
echo "Próximos pasos:"
echo "  1. Editar .env con tus JWT secrets (openssl rand -base64 32)"
echo "  2. pnpm dev              → levantar web + api en modo desarrollo"
echo "  3. docker compose up -d  → levantar toda la infraestructura"
echo ""
echo "URLs disponibles:"
echo "  🌐 Web:     http://lvh.me:3000   (o http://empresa1.lvh.me:3000)"
echo "  ⚙️  API:     http://api.lvh.me:4000"
echo "  📚 Docs:    http://api.lvh.me:4000/api/docs"
echo "  🗄️  MinIO:   http://localhost:9001  (minioadmin/minioadmin)"
echo "  📧 Mailhog: http://localhost:8025"
echo ""
