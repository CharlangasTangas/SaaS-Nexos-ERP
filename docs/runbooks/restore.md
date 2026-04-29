# Runbook: Restauración de Base de Datos

⚠️ **ADVERTENCIA:** Este proceso eliminará todos los datos actuales y los reemplazará por los del backup.

## Pre-requisitos
1. Acceso al servidor donde corre Docker.
2. El contenedor de Postgres (`nexos-postgres`) debe estar corriendo.
3. Archivo de backup disponible en `./backups/` con extensión `.sql.gz`.

## Procedimiento Automático (Recomendado)

Existe un script automatizado que toma un backup de seguridad y luego restaura el archivo:

```bash
# Listar backups disponibles
ls -lh ./backups/

# Ejecutar script (pedirá confirmación escribiendo 'RESTAURAR')
./scripts/restore.sh ./backups/2026-01-15.sql.gz
```

### Qué hace el script:
1. Valida que el archivo exista y el contenedor esté corriendo.
2. Pide confirmación (a menos que uses `--no-confirm`).
3. Genera un backup "pre-restore" de seguridad por si acaso.
4. Descomprime el archivo y ejecuta `pg_restore` limpiando (`--clean`) el esquema público.

## Procedimiento Manual (En caso de fallo del script)

Si el script falla, puedes hacer la restauración manualmente:

```bash
# 1. Copiar el backup al contenedor (opcional, también puedes pasarlo por stdin)
# 2. Descomprimir e inyectar
gunzip -c ./backups/2026-01-15.sql.gz | docker exec -i nexos-postgres pg_restore -U nexos -d nexos --clean --if-exists --single-transaction
```
