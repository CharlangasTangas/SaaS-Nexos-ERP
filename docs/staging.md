# Entorno Staging

El entorno de staging se utiliza para probar la aplicación de forma integrada antes de un release, utilizando contenedores estáticos (sin recarga en vivo) pero con datos efímeros.

Se ejecuta usando un *override* de Docker Compose que ajusta recursos y variables de entorno.

## Cómo levantar staging localmente

```bash
# Construir las imágenes y levantar el stack usando el override
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

### Diferencias clave con Development
- `NODE_ENV=staging`
- Límite de recursos aplicados (CPU/RAM)
- Volúmenes separados (los datos de dev no se mezclan con staging)
- `api` y `web` corren dentro de contenedores construidos, no usando `pnpm dev` en el host.

### Limpieza de Staging
Si quieres borrar todos los datos de staging para empezar de cero:
```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml down -v
```
