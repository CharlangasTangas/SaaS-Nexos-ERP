# Nexos ERP

Plataforma multi-tenant local para gestión de catálogo, inventario, ventas y clientes.

## 🚀 Setup Inicial (Máquina Nueva)

**Requisitos:**
- Node.js 20 LTS
- pnpm 9.x
- Docker y Docker Compose plugin

Ejecuta el script de setup automático:
```bash
# Dar permisos de ejecución (Linux/Mac)
chmod +x ./scripts/*.sh

# Ejecutar setup
./scripts/setup.sh
```

Si estás en Windows (Powershell) y no puedes usar el script de Bash:
```powershell
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio mailhog
pnpm exec husky
```

> **IMPORTANTE:** Edita `.env` y genera contraseñas seguras para los JWT usando `openssl rand -base64 32`.

## 💻 Desarrollo

Levantar los servicios base (si no están corriendo):
```bash
docker compose up -d postgres redis minio mailhog caddy
```

Levantar frontend y backend con recarga en vivo:
```bash
pnpm dev
```

Las URLs de desarrollo son:
- **Web:** `http://lvh.me:3000` o `http://empresa1.lvh.me:3000`
- **API:** `http://api.lvh.me:4000/health`
- **Docs (Swagger):** `http://api.lvh.me:4000/api/docs`
- **Mailhog:** `http://localhost:8025`
- **MinIO:** `http://localhost:9001` (user: minioadmin / pass: minioadmin)

## 📚 Documentación

Revisa la carpeta `/docs` para entender la infraestructura:
- [Arquitectura](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Staging](docs/staging.md)
- [Restore Backup](docs/runbooks/restore.md)

Para más detalles, consulta el plan de proyecto `nexos-erp-plan.md`.
