#!/bin/bash
# scripts/restore.sh
# Restaura un backup de PostgreSQL generado por backup.sh
#
# Uso:
#   ./scripts/restore.sh ./backups/2026-01-15.sql.gz
#   ./scripts/restore.sh ./backups/2026-01-15.sql.gz --no-confirm
#
# ⚠️  ADVERTENCIA: Este script BORRA y RECREA la base de datos.
#    Asegúrate de tener un backup actualizado antes de continuar.

set -euo pipefail

# ─── Configuración ───────────────────────────────────────────────────────────
DB_CONTAINER="${POSTGRES_CONTAINER:-nexos-postgres}"
DB_USER="${POSTGRES_USER:-nexos}"
DB_NAME="${POSTGRES_DB:-nexos}"
BACKUP_FILE="${1:-}"
NO_CONFIRM="${2:-}"

# ─── Validaciones ────────────────────────────────────────────────────────────
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: debes especificar el archivo de backup"
  echo "   Uso: ./scripts/restore.sh ./backups/YYYY-MM-DD.sql.gz"
  echo ""
  echo "   Backups disponibles:"
  ls -lh ./backups/*.sql.gz 2>/dev/null || echo "   (ninguno en ./backups/)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: el archivo '${BACKUP_FILE}' no existe"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "❌ El contenedor '${DB_CONTAINER}' no está corriendo."
  exit 1
fi

# ─── Confirmación de seguridad ───────────────────────────────────────────────
FILESIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "⚠️  RESTAURACIÓN DE BASE DE DATOS"
echo "   ================================"
echo "   Archivo:   ${BACKUP_FILE} (${FILESIZE})"
echo "   Base:      ${DB_NAME}@${DB_CONTAINER}"
echo "   Timestamp: $(date +%Y-%m-%dT%H:%M:%S)"
echo ""
echo "   ⚠️  ESTO BORRARÁ TODOS LOS DATOS ACTUALES DE '${DB_NAME}'"

if [ "$NO_CONFIRM" != "--no-confirm" ]; then
  read -p "   ¿Continuar? Escribe 'RESTAURAR' para confirmar: " CONFIRM
  if [ "$CONFIRM" != "RESTAURAR" ]; then
    echo "   Restauración cancelada."
    exit 0
  fi
fi

# ─── Tomar backup previo antes de restaurar ──────────────────────────────────
PRE_RESTORE_BACKUP="./backups/pre-restore-$(date +%Y-%m-%dT%H-%M-%S).sql.gz"
echo ""
echo "🛡️  Tomando backup de seguridad antes de restaurar..."
docker exec "$DB_CONTAINER" \
  pg_dump \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --compress=9 \
| gzip -9 > "$PRE_RESTORE_BACKUP" 2>/dev/null || true

if [ -f "$PRE_RESTORE_BACKUP" ]; then
  echo "   Backup de seguridad: ${PRE_RESTORE_BACKUP}"
fi

# ─── Restaurar ───────────────────────────────────────────────────────────────
echo ""
echo "🔄 Iniciando restauración..."

# Descomprimir y restaurar
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" \
  pg_restore \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --clean \
    --if-exists \
    --no-password \
    --single-transaction \
    --format=custom \
    --verbose \
  2>&1 | tail -20

echo ""
echo "✅ Restauración completada exitosamente"
echo "   Fuente: ${BACKUP_FILE}"
echo "   Backup de seguridad: ${PRE_RESTORE_BACKUP}"
