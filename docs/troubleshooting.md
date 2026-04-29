# Troubleshooting Común

## Error de Makefile en Windows
Si intentas ejecutar `make setup` en Windows y obtienes un error:
- Usa Git Bash, WSL (Windows Subsystem for Linux), o instala `make` vía Chocolatey o Scoop.
- Alternativamente, corre los comandos del `setup.sh` de forma manual en PowerShell:
  ```powershell
  cp .env.example .env
  pnpm install
  docker compose up -d postgres redis minio mailhog
  pnpm exec husky
  ```

## El subdominio lvh.me no resuelve
`lvh.me` es un servicio público que resuelve a `127.0.0.1`. Si tu proveedor de internet bloquea esta resolución:
- Solución offline: Edita tu archivo `hosts` (en `/etc/hosts` o `C:\Windows\System32\drivers\etc\hosts`):
  ```
  127.0.0.1 lvh.me
  127.0.0.1 api.lvh.me
  127.0.0.1 empresa1.lvh.me
  ```

## Docker Consume Mucha RAM en Local
El stack completo puede requerir varios GBs de memoria. Si tu máquina sufre:
1. Apaga Mailhog si no estás probando emails: `docker stop nexos-mailhog`.
2. Apaga Caddy y accede directo por `localhost:3000` y `localhost:4000` (pierdes la magia del subdominio, deberás setear la cookie de tenant manualmente).
3. Asegúrate de no tener volúmenes huérfanos muy grandes: `docker system prune --volumes`.

## Prisma "Table does not exist"
Asegúrate de haber corrido las migraciones:
```bash
pnpm --filter @nexos/api db:migrate
```

## "Error: Cannot find module '@nexos/types'"
El monorepo usa Turborepo. Si agregas tipos nuevos, debes hacer un build de ese paquete antes de que los demás lo vean correctamente en TS (aunque el runtime suele resolverlo por los bundlers):
```bash
pnpm build --filter=@nexos/types
```
