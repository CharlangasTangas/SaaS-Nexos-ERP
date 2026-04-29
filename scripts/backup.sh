#!/bin/bash
# scripts/backup.sh
# Genera un backup comprimido de PostgreSQL en ./backups/YYYY-MM-DD.sql.gz
#
# Uso:
#   ./scripts/backup.sh                    # backup de hoy
#   ./scripts/backup.sh --tag pre-release  # backup con tag adicional
#
# Requiere: Docker corriendo con el contenedor nexos-postgres

set -euo pipefail

# ─── Configuración ───────────────────────────────────────────────────────────
DB_CONTAINER="${POSTGRES_CONTAINER:-nexos-postgres}"
DB_USER="${POSTGRES_USER:-nexos}"
DB_NAME="${POSTGRES_DB:-nexos}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
TAG="${2:-}"

# ─── Construir nombre del archivo ────────────────────────────────────────────
if [ -n "$TAG" ]; then
  FILENAME="${DATE}_${TAG}.sql.gz"
else
  FILENAME="${DATE}.sql.gz"
fi

BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

# ─── Validaciones ────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "❌ El contenedor '${DB_CONTAINER}' no está corriendo."
  echo "   Levanta el stack con: docker compose up -d postgres"
  exit 1
fi

# ─── Ejecutar backup ─────────────────────────────────────────────────────────
echo "🗄️  Iniciando backup de Nexos ERP..."
echo "   DB:      ${DB_NAME}@${DB_CONTAINER}"
echo "   Destino: ${BACKUP_PATH}"
echo "   Hora:    ${TIMESTAMP}"

docker exec "$DB_CONTAINER" \
  pg_dump \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --compress=9 \
    --no-password \
| gzip -9 > "$BACKUP_PATH"

# ─── Verificar resultado ─────────────────────────────────────────────────────
if [ -f "$BACKUP_PATH" ]; then
  SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
  echo "✅ Backup completado: ${BACKUP_PATH} (${SIZE})"
else
  echo "❌ Error: el archivo de backup no fue creado"
  exit 1
fi

# ─── Limpiar backups antiguos (mantener últimos 30 días) ─────────────────────
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true
echo "🧹 Backups anteriores a ${KEEP_DAYS} días eliminados"

echo ""
echo "📋 Backups disponibles:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "   (ninguno)"
