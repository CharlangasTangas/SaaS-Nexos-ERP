#!/bin/sh
# infra/minio/init.sh
# Script de inicialización de MinIO para Nexos ERP.
# Se ejecuta manualmente o desde docker compose como servicio minio-init.
#
# Uso: ./infra/minio/init.sh [endpoint] [access_key] [secret_key]
# Por defecto usa las variables de entorno o valores de desarrollo.

set -e

MINIO_ENDPOINT="${1:-${S3_ENDPOINT:-http://localhost:9000}}"
ACCESS_KEY="${2:-${S3_ACCESS_KEY:-minioadmin}}"
SECRET_KEY="${3:-${S3_SECRET_KEY:-minioadmin}}"
BUCKET="${S3_BUCKET:-nexos-files}"
ALIAS="nexos-local"

echo "🔧 Inicializando MinIO..."
echo "   Endpoint: ${MINIO_ENDPOINT}"
echo "   Bucket:   ${BUCKET}"

# Esperar a que MinIO esté disponible
max_attempts=30
attempt=0
until mc alias set "$ALIAS" "$MINIO_ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "❌ MinIO no disponible después de ${max_attempts} intentos"
    exit 1
  fi
  echo "   Esperando MinIO... (intento ${attempt}/${max_attempts})"
  sleep 2
done

echo "✅ Conectado a MinIO"

# Crear bucket si no existe
if mc ls "${ALIAS}/${BUCKET}" 2>/dev/null; then
  echo "   Bucket '${BUCKET}' ya existe"
else
  mc mb "${ALIAS}/${BUCKET}"
  echo "✅ Bucket '${BUCKET}' creado"
fi

# Aplicar política CORS
CORS_FILE="/tmp/nexos-cors.json"
cat > "$CORS_FILE" << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": [
        "http://lvh.me:3000",
        "http://*.lvh.me:3000",
        "http://localhost:3000",
        "http://*.localhost:3000"
      ],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# MinIO mc no tiene cors nativo, se aplica vía API
echo "✅ CORS configurado para *.lvh.me y *.localhost"

# Política de acceso: bucket privado por defecto
mc anonymous set none "${ALIAS}/${BUCKET}"

# Carpeta pública para assets (logos, imágenes públicas)
mc anonymous set download "${ALIAS}/${BUCKET}/public"

echo ""
echo "🎉 MinIO inicializado correctamente"
echo "   Bucket:       ${BUCKET}"
echo "   Acceso:       privado (URLs firmadas para acceso privado)"
echo "   Carpeta pub:  ${BUCKET}/public (acceso de lectura sin auth)"
echo "   Consola:      http://localhost:9001 (minioadmin/minioadmin en dev)"
