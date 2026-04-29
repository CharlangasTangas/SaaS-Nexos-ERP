# Arquitectura Nexos ERP

## Diagrama de Componentes

```mermaid
flowchart TB
    subgraph Cliente["🌐 Cliente (Browser)"]
        SUB["empresa1.lvh.me:3000<br/>empresa2.lvh.me:3000"]
    end

    subgraph Frontend["🎨 Frontend - Next.js 14 (Docker / Local)"]
        APP["App Router<br/>+ Server Components"]
        MW["middleware.ts<br/>(extrae tenant del subdominio)"]
        UI["shadcn/ui + Tailwind"]
        STATE["Zustand + TanStack Query"]
    end

    subgraph Backend["⚙️ Backend - NestJS 10 (Docker / Local)"]
        GATEWAY["API Gateway<br/>(global guards + interceptors)"]
        AUTH_M["Módulo Auth<br/>JWT + Refresh"]
        TENANT_M["Módulo Tenants"]
        PROD_M["Módulo Products"]
        INV_M["Módulo Inventory"]
        SALES_M["Módulo Sales"]
        CUST_M["Módulo Customers"]
        TENANT_CTX["TenantContext<br/>(AsyncLocalStorage)"]
    end

    subgraph Datos["🗄️ Capa de Datos (Docker)"]
        PRISMA["Prisma ORM<br/>(con extensión RLS)"]
        PG[("PostgreSQL 16<br/>+ Row-Level Security")]
        REDIS[("Redis 7<br/>cache + sessions")]
    end

    subgraph Auxiliares["🔌 Servicios Auxiliares (Docker locales)"]
        MINIO["MinIO<br/>(almacenamiento S3-compatible)"]
        MAILHOG["Mailhog<br/>(captura de emails)"]
        CADDY["Caddy<br/>(Reverse Proxy local)"]
    end

    SUB --> CADDY
    CADDY --> MW
    CADDY --> GATEWAY
    MW --> APP
    UI --> APP
    STATE --> APP
    APP --> GATEWAY
    GATEWAY --> AUTH_M & TENANT_M & PROD_M & INV_M & SALES_M & CUST_M
    AUTH_M & TENANT_M & PROD_M & INV_M & SALES_M & CUST_M --> TENANT_CTX
    TENANT_CTX --> PRISMA --> PG
    GATEWAY --> REDIS
    PROD_M --> MINIO
    AUTH_M --> MAILHOG
```

## Stack Tecnológico

**Monorepo:** Turborepo + pnpm workspaces
**Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Hook Form, Zod
**Backend:** NestJS 10, Prisma ORM, Zod, Passport (JWT), Argon2
**Infraestructura (Local Docker):**
- PostgreSQL 16
- Redis 7
- MinIO (S3 compatible)
- Mailhog (SMTP Mock)
- Caddy (Reverse Proxy)

## Multi-Tenancy

El aislamiento se logra a nivel de base de datos usando **PostgreSQL Row-Level Security (RLS)** y un esquema compartido (`shared-schema + tenant_id`).
- El tenant se identifica por el subdominio (`tenant1.lvh.me`).
- Next.js `middleware.ts` extrae el subdominio y lo pasa en el header `X-Tenant-Slug`.
- NestJS extrae el header, busca el tenant, y usa `AsyncLocalStorage` para guardar el ID.
- Una extensión de Prisma inyecta `SET LOCAL app.tenant_id = '...'` antes de cada query.
- Las políticas RLS en Postgres garantizan que ningún tenant pueda acceder a datos de otro, incluso si hay un bug en el código de Prisma.
