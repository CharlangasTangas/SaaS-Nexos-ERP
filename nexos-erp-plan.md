# 📘 Plan de Proyecto — Nexos ERP

> **Plataforma multi-tenant local** para gestión de catálogo, inventario, ventas y clientes en empresas de distintos sectores (invernaderos, procesadoras de carne, distribuidoras).
>
> **Equipo:** 4 personas (nivel intermedio) · **Plazo MVP:** 8 semanas · **Entorno:** 100% local (sin servicios cloud de pago) · **Versión del plan:** 2.0

---

## 🎯 Resumen Ejecutivo

Nexos ERP se construirá como un **monolito modular** ejecutado en contenedores Docker en máquinas locales, usando una estrategia de multi-tenancy de **shared-schema con `tenant_id` + Row-Level Security (RLS)** sobre PostgreSQL para garantizar aislamiento absoluto entre empresas. El stack será **Next.js 14 (App Router) + NestJS 10 + Prisma + PostgreSQL 16**, todo orquestado con Docker Compose, con identificación de tenant por **subdominio wildcard** resolviéndose en `*.lvh.me` o `*.localhost` (no requiere DNS público). El trabajo se paraleliza desde el día 1 dividiendo al equipo en 4 tracks (DevOps/Infra, Core Multi-tenancy, Módulos de Negocio, Frontend) que comparten contratos OpenAPI y un monorepo (Turborepo). Se prioriza seguridad (JWT con claim de tenant, RLS, auditoría) sobre features avanzadas, con CI local desde la semana 1 y test coverage objetivo ≥70% en lógica de negocio. El MVP cubrirá: registro de tenants, autenticación con roles, CRUD de productos/categorías/clientes, control de stock con movimientos, registro de ventas con descuento de inventario y dashboard básico — todo corriendo sin dependencias externas de pago.

---

## 1️⃣ Arquitectura del Sistema

### 1.1 Patrón Arquitectónico: Monolito Modular

**Decisión:** Monolito modular en NestJS organizado por *bounded contexts*, NO microservicios.

**Justificación para 4 personas / 8 semanas / entorno local:**

| Criterio | Microservicios | Monolito Modular ✅ |
|---|---|---|
| Complejidad operacional | Alta (k8s, service mesh, observabilidad distribuida) | Baja (un solo `docker compose up`) |
| Tiempo de bootstrap | 3-4 semanas solo en infra | 2-3 días |
| Debugging | Distribuido, traces obligatorios | Stack trace local |
| Recursos en máquina dev | Muy alto (RAM, CPU) | Bajo |
| Riesgo para MVP | Alto (sobrediseño) | Bajo |
| Refactor a microservicios | Posible si los módulos están bien aislados | Sí, esa es la idea |

Cada módulo (`auth`, `tenants`, `products`, `inventory`, `sales`, `customers`) vive en su propia carpeta con sus controllers, services, DTOs y tests, comunicándose por interfaces (no por imports directos a internals).

### 1.2 Estrategia Multi-Tenancy

| Estrategia | Aislamiento | Coste de recursos | Operación | Escalabilidad | Veredicto |
|---|---|---|---|---|---|
| **Database-per-tenant** | Máximo | Muy alto (N instancias) | Migraciones N veces, backups N veces | Pésima a >50 tenants | ❌ |
| **Schema-per-tenant** | Alto | Medio (1 BD, N schemas) | Migraciones N veces, search_path frágil | Buena hasta ~500 tenants | ⚠️ |
| **Shared-schema + `tenant_id` + RLS** | Alto (a nivel BD) | Bajo (1 BD, 1 schema) | Una migración para todos | Excelente (>10k tenants) | ✅ |

**Decisión: Shared-schema con `tenant_id` y PostgreSQL Row-Level Security.**

**Justificación:**
- **Seguridad por capas:** El aislamiento NO depende del código aplicativo. PostgreSQL RLS aplica el filtro `tenant_id = current_setting('app.tenant_id')` a cada query, incluso si un desarrollador olvida el `WHERE`. Si el `SET app.tenant_id` no se ejecuta, las queries devuelven 0 filas.
- **Recursos locales:** Una sola instancia de PostgreSQL en Docker gestiona todos los tenants de prueba sin saturar la máquina del desarrollador.
- **Migraciones:** Una única ejecución de Prisma migra a todos los tenants simultáneamente.
- **Riesgo mitigado:** El típico problema del shared-schema (olvidar el filtro) se elimina con RLS forzado.

### 1.3 Diagrama de Capas/Componentes

```mermaid
flowchart TB
    subgraph Cliente["🌐 Cliente (Browser)"]
        SUB["empresa1.lvh.me:3000<br/>empresa2.lvh.me:3000"]
    end

    subgraph Frontend["🎨 Frontend - Next.js 14 (Docker)"]
        APP["App Router<br/>+ Server Components"]
        MW["middleware.ts<br/>(extrae tenant del subdominio)"]
        UI["shadcn/ui + Tailwind"]
        STATE["Zustand + TanStack Query"]
    end

    subgraph Backend["⚙️ Backend - NestJS 10 (Docker)"]
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
        REDIS[("Redis<br/>cache + sessions")]
    end

    subgraph Auxiliares["🔌 Servicios Auxiliares (Docker, locales)"]
        MINIO["MinIO<br/>(almacenamiento S3-compatible)"]
        MAILHOG["Mailhog<br/>(captura de emails)"]
    end

    SUB --> APP
    APP --> MW --> GATEWAY
    UI --> APP
    STATE --> APP
    GATEWAY --> AUTH_M & TENANT_M & PROD_M & INV_M & SALES_M & CUST_M
    AUTH_M & TENANT_M & PROD_M & INV_M & SALES_M & CUST_M --> TENANT_CTX
    TENANT_CTX --> PRISMA --> PG
    GATEWAY --> REDIS
    PROD_M --> MINIO
    AUTH_M --> MAILHOG
```

> **Todo corre en `docker compose`** en la máquina del desarrollador. No hay servicios externos de pago.

### 1.4 Autenticación y Autorización

**Flujo de autenticación:**

1. Usuario accede a `empresa1.lvh.me:3000/login`.
2. `middleware.ts` (Next.js) extrae `tenantSlug = "empresa1"` del subdominio y lo añade al header `X-Tenant-Slug`.
3. POST `/auth/login` con `{ email, password }` + header `X-Tenant-Slug`.
4. Backend valida: (a) el tenant existe y está activo, (b) el usuario pertenece a ese tenant, (c) la contraseña hash coincide (argon2id).
5. Backend emite **JWT de acceso (15 min)** + **Refresh token (7 días, httpOnly cookie)**.

**Estructura del JWT:**

```json
{
  "sub": "user_uuid",
  "tenantId": "tenant_uuid",
  "tenantSlug": "empresa1",
  "roles": ["admin"],
  "permissions": ["products:write", "sales:read"],
  "iat": 1735000000,
  "exp": 1735000900
}
```

**Autorización (RBAC):**

- Roles del sistema: `OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`.
- Permisos granulares: `<recurso>:<acción>` (ej: `products:write`, `inventory:adjust`, `sales:create`, `reports:view`).
- Decoradores en NestJS: `@Roles('ADMIN')`, `@Permissions('sales:create')`.
- Guard global: `JwtAuthGuard` → `TenantGuard` (verifica que `req.user.tenantId === resolved tenant`) → `RolesGuard`.

### 1.5 Identificación de Tenant por Subdominio (sin DNS público)

**En desarrollo local** se usa `lvh.me` (servicio público gratuito que resuelve `*.lvh.me` a `127.0.0.1`) o `*.localhost` (soportado por navegadores modernos).

```
empresa1.lvh.me:3000   → 127.0.0.1
empresa2.lvh.me:3000   → 127.0.0.1
admin.lvh.me:3000      → 127.0.0.1
```

**Alternativa offline (sin acceso a internet):** editar `/etc/hosts`:

```
127.0.0.1   empresa1.nexos.local
127.0.0.1   empresa2.nexos.local
127.0.0.1   admin.nexos.local
```

**Resolución en código:**

```typescript
// middleware.ts (Next.js)
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const subdomain = host.split('.')[0];

  if (['www', 'app', 'api', ''].includes(subdomain)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}
```

```typescript
// tenant.middleware.ts (NestJS)
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantsService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug = req.headers['x-tenant-slug'] as string;
    if (!slug) throw new BadRequestException('Tenant header missing');

    const tenant = await this.tenants.findActiveBySlug(slug);
    if (!tenant) throw new NotFoundException('Tenant not found or inactive');

    TenantContext.run({ tenantId: tenant.id, slug }, () => next());
  }
}
```

---

## 2️⃣ Diseño de Base de Datos

### 2.1 Modelo Entidad-Relación (Mermaid)

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "tiene"
    TENANTS ||--o{ PRODUCTS : "tiene"
    TENANTS ||--o{ CATEGORIES : "tiene"
    TENANTS ||--o{ CUSTOMERS : "tiene"
    TENANTS ||--o{ SALES : "tiene"
    TENANTS ||--o{ WAREHOUSES : "tiene"
    USERS }o--|| ROLES : "tiene"
    ROLES ||--o{ ROLE_PERMISSIONS : "agrupa"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "se asigna a"
    CATEGORIES ||--o{ PRODUCTS : "clasifica"
    PRODUCTS ||--o{ INVENTORY : "tiene stock en"
    WAREHOUSES ||--o{ INVENTORY : "almacena"
    INVENTORY ||--o{ STOCK_MOVEMENTS : "registra"
    USERS ||--o{ STOCK_MOVEMENTS : "ejecuta"
    CUSTOMERS ||--o{ SALES : "compra"
    USERS ||--o{ SALES : "registra"
    SALES ||--o{ SALE_ITEMS : "contiene"
    PRODUCTS ||--o{ SALE_ITEMS : "se vende como"
    SALES ||--o| INVOICES : "genera"
    USERS ||--o{ AUDIT_LOGS : "produce"
```

### 2.2 Catálogo de Tablas

> **Nota:** Toda tabla de negocio incluye `tenant_id UUID NOT NULL` y queda protegida por RLS. Los timestamps `created_at`, `updated_at` y `deleted_at` (soft delete) están presentes en todas salvo donde se indique.

#### `tenants` (raíz, sin `tenant_id`)

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| id | UUID | PK, default gen_random_uuid() | |
| slug | VARCHAR(63) | UNIQUE, NOT NULL | Subdominio (`empresa1`) |
| name | VARCHAR(200) | NOT NULL | Razón social |
| business_type | ENUM | NOT NULL | `GREENHOUSE`, `MEAT_PROCESSING`, `DISTRIBUTOR`, `OTHER` |
| status | ENUM | NOT NULL, default 'ACTIVE' | `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| settings | JSONB | default '{}' | Configuración por tenant |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Índices:** `UNIQUE(slug)`, `INDEX(status)`.

#### `users`

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants(id), NOT NULL | RLS |
| email | VARCHAR(255) | NOT NULL | |
| password_hash | TEXT | NOT NULL | argon2id |
| full_name | VARCHAR(200) | NOT NULL | |
| role_id | UUID | FK → roles(id), NOT NULL | |
| is_active | BOOLEAN | NOT NULL, default true | |
| last_login_at | TIMESTAMPTZ | NULL | |
| created_at, updated_at, deleted_at | TIMESTAMPTZ | | |

**Índices:** `UNIQUE(tenant_id, email)`, `INDEX(tenant_id, is_active)`.

#### `roles`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| name | VARCHAR(50) | NOT NULL |
| description | TEXT | NULL |
| is_system | BOOLEAN | default false |

**Índices:** `UNIQUE(tenant_id, name)`.

#### `permissions` (catálogo global, sin `tenant_id`)

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| code | VARCHAR(100) | UNIQUE, NOT NULL (ej: `products:write`) |
| description | TEXT | |

#### `role_permissions`

| Columna | Tipo | Constraints |
|---|---|---|
| role_id | UUID | FK → roles(id), ON DELETE CASCADE |
| permission_id | UUID | FK → permissions(id) |

**PK compuesta:** `(role_id, permission_id)`.

#### `categories`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| name | VARCHAR(150) | NOT NULL |
| parent_id | UUID | FK → categories(id), NULL |
| description | TEXT | |

**Índices:** `UNIQUE(tenant_id, name, parent_id)`, `INDEX(tenant_id, parent_id)`.

#### `products`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| sku | VARCHAR(50) | NOT NULL |
| name | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| category_id | UUID | FK → categories(id), NULL |
| unit | VARCHAR(20) | NOT NULL (ej: `kg`, `unit`, `box`) |
| price | NUMERIC(12,2) | NOT NULL, CHECK ≥ 0 |
| cost | NUMERIC(12,2) | default 0 |
| min_stock | NUMERIC(12,3) | default 0 |
| is_active | BOOLEAN | default true |
| metadata | JSONB | default '{}' |

**Índices:** `UNIQUE(tenant_id, sku)`, `INDEX(tenant_id, category_id)`, `INDEX(tenant_id, name) USING gin (name gin_trgm_ops)`.

#### `warehouses`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| name | VARCHAR(150) | NOT NULL |
| address | TEXT | |
| is_default | BOOLEAN | default false |

#### `inventory`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| product_id | UUID | FK → products(id), NOT NULL |
| warehouse_id | UUID | FK → warehouses(id), NOT NULL |
| quantity | NUMERIC(12,3) | NOT NULL, CHECK ≥ 0, default 0 |
| reserved | NUMERIC(12,3) | default 0 |

**Índices:** `UNIQUE(tenant_id, product_id, warehouse_id)`.

#### `stock_movements`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| inventory_id | UUID | FK → inventory(id), NOT NULL |
| type | ENUM | `IN`, `OUT`, `ADJUSTMENT`, `TRANSFER` |
| quantity | NUMERIC(12,3) | NOT NULL |
| reference_type | VARCHAR(30) | NULL (`SALE`, `PURCHASE`, `MANUAL`) |
| reference_id | UUID | NULL |
| user_id | UUID | FK → users(id) |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL |

**Índices:** `INDEX(tenant_id, inventory_id, created_at DESC)`, `INDEX(tenant_id, reference_type, reference_id)`.

#### `customers`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| name | VARCHAR(200) | NOT NULL |
| tax_id | VARCHAR(30) | (RFC, NIT, RUT…) |
| email | VARCHAR(255) | |
| phone | VARCHAR(30) | |
| address | TEXT | |
| credit_limit | NUMERIC(12,2) | default 0 |

**Índices:** `UNIQUE(tenant_id, tax_id) WHERE tax_id IS NOT NULL`, `INDEX(tenant_id, name)`.

#### `sales`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| number | VARCHAR(20) | NOT NULL (folio, ej: `V-000123`) |
| customer_id | UUID | FK → customers(id), NULL |
| user_id | UUID | FK → users(id), NOT NULL |
| status | ENUM | `DRAFT`, `CONFIRMED`, `CANCELLED` |
| subtotal | NUMERIC(12,2) | NOT NULL |
| tax | NUMERIC(12,2) | default 0 |
| total | NUMERIC(12,2) | NOT NULL |
| paid_at | TIMESTAMPTZ | NULL |
| notes | TEXT | |

**Índices:** `UNIQUE(tenant_id, number)`, `INDEX(tenant_id, status, created_at DESC)`, `INDEX(tenant_id, customer_id)`.

#### `sale_items`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| sale_id | UUID | FK → sales(id) ON DELETE CASCADE |
| product_id | UUID | FK → products(id) |
| quantity | NUMERIC(12,3) | NOT NULL, CHECK > 0 |
| unit_price | NUMERIC(12,2) | NOT NULL |
| discount | NUMERIC(12,2) | default 0 |
| subtotal | NUMERIC(12,2) | NOT NULL |

#### `invoices`

| Columna | Tipo | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK, NOT NULL |
| sale_id | UUID | FK → sales(id), UNIQUE |
| number | VARCHAR(30) | NOT NULL |
| issued_at | TIMESTAMPTZ | NOT NULL |
| pdf_path | TEXT | (ruta en MinIO local) |

#### `audit_logs`

| Columna | Tipo | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| tenant_id | UUID | NOT NULL |
| user_id | UUID | NULL |
| action | VARCHAR(50) | (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`) |
| entity | VARCHAR(50) | (`Product`, `Sale`, …) |
| entity_id | UUID | |
| diff | JSONB | |
| ip | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL |

**Índices:** `INDEX(tenant_id, entity, entity_id)`, `INDEX(tenant_id, created_at DESC)`.

### 2.3 Aislamiento Multi-Tenant a Nivel de BD

**Activación de RLS (ejemplo `products`):**

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Inyección del contexto en cada request (Prisma):**

```typescript
// prisma-tenant.extension.ts
export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const ctx = TenantContext.getStore();
          if (!ctx) throw new Error('Tenant context missing');
          await client.$executeRawUnsafe(
            `SET LOCAL app.tenant_id = '${ctx.tenantId}'`,
          );
          return query(args);
        },
      },
    },
  }),
);
```

> **Defensa en profundidad:** además del RLS, Prisma incluye `tenant_id` en todos los `where` automáticamente vía un middleware. Si el RLS fallara, el filtro aplicativo sigue activo. Si el filtro aplicativo fallara, el RLS bloquea.

### 2.4 Estrategia de Migraciones y Seeds

- **Migraciones:** Prisma Migrate. Convención: `YYYYMMDDHHMM_descripcion`. Ejecutadas en CI antes del build.
- **Seeds:**
  - `seed:permissions` → catálogo global de permisos (idempotente).
  - `seed:dev` → 2 tenants ficticios + usuarios de prueba (solo en `NODE_ENV !== 'production'`).
  - `seed:tenant <slug>` → al crear un tenant: roles base, almacén default, categorías template.

```bash
pnpm --filter api prisma migrate dev --name add_inventory_table
pnpm --filter api prisma migrate deploy
pnpm --filter api seed:permissions
```

---

## 3️⃣ Stack Tecnológico

### 3.1 Frontend

| Componente | Elección | Justificación |
|---|---|---|
| Framework | **Next.js 14.x (App Router)** | SSR/RSC, middleware nativo para subdominios, gran comunidad. |
| Lenguaje | TypeScript 5.x | Tipado obligatorio del contrato OpenAPI. |
| UI | **shadcn/ui + Tailwind CSS 3.x + Radix UI** | Copy-paste, sin lock-in, accesible, instalación local. |
| Iconos | lucide-react | Open source. |
| Estado servidor | **TanStack Query v5** | Cache, invalidación, retry. |
| Estado cliente | **Zustand** | Simple, sin boilerplate. |
| Formularios | **React Hook Form + Zod** | Validación compartida con backend. |
| Tablas | TanStack Table v8 | Headless, virtualización. |
| Gráficas | Recharts | Suficiente para dashboards MVP. |

### 3.2 Backend

| Componente | Elección | Justificación |
|---|---|---|
| Lenguaje | TypeScript 5.x | Compartir DTOs/Zod schemas con frontend. |
| Runtime | Node.js 20 LTS | LTS, soporte nativo `fetch`. |
| Framework | **NestJS 10.x** | Modular, DI, ecosistema maduro de guards/interceptors. |
| ORM | **Prisma 5.x** | Tipado fuerte, migraciones, soporte para extensiones (RLS). |
| Validación | **Zod 3.x + nestjs-zod** | Mismo schema en front y back. |
| Auth | `@nestjs/jwt` + `passport-jwt` + `argon2` | Open source, estándar. |
| Docs API | `@nestjs/swagger` (OpenAPI 3.1) | Generado automáticamente. |
| Jobs | BullMQ + Redis | Reportes, emails, generación de PDFs. |
| Logs | Pino | JSON estructurado, salida a stdout/archivo. |
| PDFs | PDFKit (o Puppeteer si HTML→PDF) | Generación local, sin dependencia externa. |

### 3.3 Base de Datos y Auxiliares (todos en Docker, locales)

| Componente | Elección | Justificación |
|---|---|---|
| Motor | **PostgreSQL 16** | RLS robusto, JSONB, extensiones (`pg_trgm`, `uuid-ossp`), libre. |
| Cache | **Redis 7** | Sesiones, rate limit, queue de BullMQ. |
| Almacenamiento de archivos | **MinIO** | S3-compatible, 100% local. Reemplaza R2/S3 sin cambiar el código. |
| Email (dev/staging) | **Mailhog** | SMTP fake que captura emails y los muestra en UI web. Cero envíos reales. |
| Backups | `pg_dump` cron en contenedor | Volumen Docker persistente; snapshot diario a `./backups/`. |

### 3.4 Infraestructura (100% Local)

| Componente | Elección | Justificación |
|---|---|---|
| Orquestación | **Docker + Docker Compose** | Un solo `docker compose up` levanta todo. |
| Contenedores | Dockerfile multi-stage por app | Imágenes optimizadas <300 MB. |
| CI | **GitHub Actions** (free en repos públicos) o **Gitea Actions / Drone** auto-hospedados | Gratuitos en cualquier modalidad. |
| Repositorio | Git (GitHub free, GitLab free, Gitea local) | |
| Reverse proxy local (opcional) | **Caddy** o **Traefik** (Docker) | Maneja `*.lvh.me` y rutea a frontend/backend. |
| Gestión de secretos | Archivo `.env` por entorno (gitignored) + `.env.example` versionado | |

### 3.5 Herramientas Auxiliares

| Componente | Elección |
|---|---|
| Testing unitario | Vitest |
| Testing E2E backend | Supertest + Vitest |
| Testing E2E frontend | Playwright |
| Lint | ESLint 9 (flat config) + Prettier 3 |
| Pre-commit | Husky + lint-staged + commitlint |
| Type check | `tsc --noEmit` en CI |
| Errores | **GlitchTip** auto-hospedado (Docker, alternativa OSS de Sentry) o logs en archivo |
| Logs | Pino → stdout → archivo rotado con `logrotate` o `pino-pretty` en dev |
| Métricas (opcional) | **Prometheus + Grafana** (Docker) si el equipo quiere; no obligatorio para MVP |
| Documentación interna | Markdown en `/docs` + Mermaid |
| Monorepo | **Turborepo + pnpm workspaces** | Cache de builds, paralelización. |

> **Todas las herramientas son gratuitas u open source. No se requiere tarjeta de crédito ni cuentas de pago.**

---

## 4️⃣ Requisitos Previos

### 4.1 Software (versiones específicas)

```bash
node            v20.11.x    (recomendado: nvm)
pnpm            v9.x
docker          >= 24.x
docker compose  plugin v2
git             >= 2.40
make            (opcional, para Makefile de comandos)
```

> **No se requiere instalar Postgres, Redis ni MinIO manualmente:** todo corre en Docker.

### 4.2 Cuentas y Servicios Externos

| Servicio | Uso | Coste |
|---|---|---|
| GitHub / GitLab / Gitea | Repo + CI | Free |

> **Eso es todo.** No se requieren cuentas de pago, ni tarjetas, ni servicios cloud.

### 4.3 Conocimientos Mínimos por Rol

| Rol | Debe saber |
|---|---|
| P1 — DevOps | Docker, Docker Compose, GitHub Actions, redes locales, PostgreSQL admin |
| P2 — Backend Core | NestJS, Prisma, JWT, RLS de Postgres, testing |
| P3 — Backend Negocio | NestJS, transacciones SQL, modelado de dominio, testing |
| P4 — Frontend | React, Next.js App Router, Tailwind, TanStack Query, formularios |

### 4.4 Configuración de Entornos

| Entorno | Branch | Cómo se levanta | Datos |
|---|---|---|---|
| **Local (dev)** | `feature/*` | `docker compose up` en máquina del desarrollador | BD Docker con seeds |
| **Staging** | `develop` | `docker compose -f docker-compose.staging.yml up` en una máquina compartida del equipo (PC de un miembro o VM en LAN) | BD efímera, datos sintéticos |
| **Producción local** | `main` | `docker compose -f docker-compose.prod.yml up` en la máquina destinada a producción | BD real con backups locales |

> Los tres entornos usan la misma stack Docker; cambian las variables de entorno y los volúmenes de datos.

### 4.5 Variables de Entorno

```bash
# .env.example
# --- App ---
NODE_ENV=development
APP_URL=http://lvh.me:3000
API_URL=http://api.lvh.me:4000
ROOT_DOMAIN=lvh.me

# --- Database (Docker) ---
DATABASE_URL=postgresql://nexos:nexos@postgres:5432/nexos?schema=public
SHADOW_DATABASE_URL=postgresql://nexos:nexos@postgres:5432/nexos_shadow

# --- Redis (Docker) ---
REDIS_URL=redis://redis:6379

# --- Auth ---
JWT_ACCESS_SECRET=<generar con: openssl rand -base64 32>
JWT_REFRESH_SECRET=<generar con: openssl rand -base64 32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2

# --- Storage (MinIO local) ---
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=nexos-files
S3_FORCE_PATH_STYLE=true

# --- Email (Mailhog local) ---
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=no-reply@nexos.local

# --- Observability ---
LOG_LEVEL=info
LOG_FILE=/var/log/nexos/app.log
```

---

## 5️⃣ Estrategia de Ramas (Git Flow Adaptado)

### 5.1 Estructura de Ramas

```
main              ← producción local (protegida, solo merge desde release/* o hotfix/*)
└── develop       ← integración (protegida, solo merge desde feature/* o release/*)
    ├── feature/NX-P1-001-monorepo-setup
    ├── feature/NX-P2-014-jwt-auth
    └── feature/NX-P4-022-login-page
release/v1.0.0    ← estabilización pre-producción
hotfix/NX-H-001-fix-rls-policy   ← fixes urgentes (rama desde main)
```

### 5.2 Convención de Nombres

```
feature/NX-<P{n}>-<###>-<slug-corto>
fix/NX-<P{n}>-<###>-<slug-corto>
hotfix/NX-H-<###>-<slug-corto>
release/v<MAJOR>.<MINOR>.<PATCH>
chore/<slug>
docs/<slug>
```

Ejemplos válidos:
- `feature/NX-P2-014-jwt-auth`
- `fix/NX-P3-031-stock-negative-bug`
- `hotfix/NX-H-002-tenant-leak`

### 5.3 Política de Pull Requests

1. PR siempre apunta a `develop` (excepto `hotfix/*` → `main` + cherry-pick a `develop`).
2. Título del PR: `NX-P2-014: feat(auth): implement JWT login flow`.
3. Descripción obligatoria: contexto, cambios, criterios de aceptación cumplidos, capturas si aplica, checklist.
4. **Mínimo 1 reviewer aprobando** (2 si toca seguridad/auth/multi-tenancy).
5. CI verde obligatorio: lint + typecheck + tests + build.
6. **No self-merge.** El que aprueba hace squash-merge.
7. Borrar la rama tras el merge.
8. Revisión cruzada: P1↔P2, P3↔P4 como pares por defecto, rotando cada 2 semanas.

### 5.4 Conventional Commits

```
<type>(<scope>): <subject>

[body opcional]

[footer opcional: BREAKING CHANGE, refs]
```

**Types permitidos:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

**Ejemplos:**
```
feat(auth): add refresh token rotation
fix(inventory): prevent negative stock on concurrent sales
chore(deps): bump prisma to 5.20
test(sales): cover discount calculation edge cases
```

Validado por `commitlint` + Husky en `commit-msg`.

---

## 6️⃣ Distribución de Tareas (4 Personas en Paralelo)

> **Nota de paralelización:** las semanas 1-2 son las más críticas para minimizar dependencias. Se publica el contrato OpenAPI desde el día 3 (mocks con MSW para front), y los módulos de negocio se construyen contra fixtures en BD.
>
> Estimación: **SP** = story points (Fibonacci). 1 SP ≈ 2-3 horas.
>
> **Cada track tiene un "Orden local"** (orden dentro del track). El **orden global cruzado** entre tracks está en la **sección 7**.

### 👤 Persona 1 — Arquitecto / DevOps & Infraestructura

| Orden local | ID | Tarea | Criterios de Aceptación | SP | Rama | Dep. |
|---|---|---|---|---|---|---|
| 1 | NX-P1-001 | Bootstrap monorepo Turborepo + pnpm | Estructura `apps/{web,api}` y `packages/{config,types,ui}` creada; `pnpm dev` levanta ambos; `turbo build` funciona | 3 | `feature/NX-P1-001-monorepo-setup` | — |
| 2 | NX-P1-002 | Docker Compose para dev (Postgres 16, Redis, MinIO, Mailhog) | `docker compose up` levanta todo; healthchecks OK; volúmenes persistentes; UI MinIO en `:9001` y Mailhog en `:8025` | 3 | `feature/NX-P1-002-docker-compose` | 001 |
| 3 | NX-P1-003 | ESLint flat config + Prettier + Husky + commitlint | `pnpm lint` y `pnpm format` funcionan; pre-commit bloquea código sucio; commits inválidos rechazados | 3 | `feature/NX-P1-003-lint-husky` | 001 |
| 4 | NX-P1-004 | Workflow CI en GitHub Actions (lint + typecheck + test + build) | PR en `develop` ejecuta el job; cache de pnpm activado; <5 min en promedio | 3 | `feature/NX-P1-004-ci-pipeline` | 001-003 |
| 5 | NX-P1-005 | Dockerfile multi-stage para `api` y `web` | Imágenes <300 MB; build en CI; `docker run` levanta ambos | 3 | `feature/NX-P1-005-dockerfiles` | 001 |
| 6 | NX-P1-006 | Reverse proxy local con Caddy para `*.lvh.me` | `empresa1.lvh.me` rutea a web, `api.lvh.me` rutea a api | 3 | `feature/NX-P1-006-caddy-proxy` | 002, 005 |
| 7 | NX-P1-007 | Stack staging (`docker-compose.staging.yml`) | Levantable en máquina del equipo en LAN; documentado en `/docs/staging.md` | 3 | `feature/NX-P1-007-staging-stack` | 005 |
| 8 | NX-P1-008 | Logging estructurado con Pino + rotación de archivos | Logs JSON a `/var/log/nexos/app.log`; correlation id por request; `logrotate` configurado | 3 | `feature/NX-P1-008-logging` | 005 |
| 9 | NX-P1-009 | (Opcional) GlitchTip auto-hospedado para errores | UI en `errors.lvh.me`; SDK integrado en api y web | 3 | `feature/NX-P1-009-glitchtip` | 002 |
| 10 | NX-P1-010 | Branch protection rules + plantilla de PR + CODEOWNERS | `main` y `develop` requieren PR + CI verde + 1 review; plantilla aplicada | 1 | `chore/NX-P1-010-branch-protection` | 004 |
| 11 | NX-P1-011 | Setup MinIO + lib de upload firmado | `getPresignedUrl()` retorna URL válida; bucket creado con CORS; subida funciona desde cliente | 3 | `feature/NX-P1-011-minio-storage` | 002 |
| 12 | NX-P1-012 | Backups automáticos de Postgres + script de restore | Cron en contenedor genera dump diario en `./backups/`; runbook `/docs/runbooks/restore.md` validado con drill | 3 | `feature/NX-P1-012-backups` | 002 |
| 13 | NX-P1-013 | Stack producción (`docker-compose.prod.yml`) + script de release | Tag `v1.0.0` en `main` ejecuta script que rebuilda imágenes y reinicia servicios; rollback documentado | 5 | `feature/NX-P1-013-prod-stack` | 005-012 |
| Continuo | NX-P1-014 | Documentación de arquitectura `/docs/architecture.md` | Diagrama actualizado; ADRs iniciados | 3 | `docs/NX-P1-014-architecture` | continuo |
| Continuo | NX-P1-015 | Makefile / scripts de bootstrap | `make setup` en máquina nueva instala deps y levanta stack | 2 | `chore/NX-P1-015-makefile` | 002 |

**Total P1:** ~44 SP

### 👤 Persona 2 — Backend Core & Multi-Tenancy

| Orden local | ID | Tarea | Criterios de Aceptación | SP | Rama | Dep. |
|---|---|---|---|---|---|---|
| 1 | NX-P2-001 | Bootstrap NestJS + Prisma + Zod | App levanta en `:4000`; `/health` retorna 200; Prisma conectado a Postgres Docker | 3 | `feature/NX-P2-001-nest-bootstrap` | P1-001, P1-002 |
| 2 | NX-P2-002 | Schema Prisma inicial (tenants, users, roles, permissions) | Migración aplicada; tablas con tenant_id; índices presentes | 3 | `feature/NX-P2-002-base-schema` | 001 |
| 3 | NX-P2-003 | OpenAPI/Swagger + tipos compartidos en `packages/types` | `/api/docs` accesible; tipos generados consumidos por front | 3 | `feature/NX-P2-003-openapi` | 002 |
| 4 | NX-P2-004 | Implementar Row-Level Security en migración SQL | Policies activas; test verifica aislamiento (tenant A no ve datos de B) | 5 | `feature/NX-P2-004-rls-policies` | 002 |
| 5 | NX-P2-005 | TenantContext con AsyncLocalStorage + extensión Prisma | Cada query setea `app.tenant_id`; sin contexto → query falla | 5 | `feature/NX-P2-005-tenant-context` | 004 |
| 6 | NX-P2-006 | Middleware de resolución de tenant por header `X-Tenant-Slug` | Tenant inactivo → 404; slug vacío → 400; tenant activo → req.tenant poblado | 3 | `feature/NX-P2-006-tenant-middleware` | 005 |
| 7 | NX-P2-007 | Módulo Auth: registro de tenant + admin (signup) | POST `/auth/signup` crea tenant + user owner + roles base + warehouse default; transaccional | 5 | `feature/NX-P2-007-tenant-signup` | 006 |
| 8 | NX-P2-008 | Login con JWT + refresh token (httpOnly cookie) | POST `/auth/login` retorna access + setea refresh cookie; argon2id | 5 | `feature/NX-P2-008-jwt-auth` | 007 |
| 9 | NX-P2-009 | Refresh token rotation + logout | POST `/auth/refresh` rota; logout invalida en Redis | 3 | `feature/NX-P2-009-refresh-rotation` | 008 |
| 10 | NX-P2-010 | Guards globales: JwtAuthGuard, TenantGuard, RolesGuard | Sin token → 401; token de otro tenant → 403; rol insuficiente → 403 | 5 | `feature/NX-P2-010-guards` | 008 |
| 11 | NX-P2-011 | RBAC: catálogo de permisos + asignación a roles | Seed de permisos idempotente; admin puede CRUD roles del tenant | 5 | `feature/NX-P2-011-rbac` | 010 |
| 12 | NX-P2-012 | Test suite de aislamiento multi-tenant | 10+ casos: tenant A no ve/edita/borra datos de B; cobertura 100% en TenantGuard | 5 | `feature/NX-P2-012-tenant-tests` | 006 |
| 13 | NX-P2-013 | CRUD usuarios en el tenant (invitación por email vía Mailhog) | Owner invita usuario; email visible en Mailhog UI; link de activación expira en 24h | 5 | `feature/NX-P2-013-user-invites` | 011, P1-002 |
| 14 | NX-P2-014 | Audit log middleware (interceptor global) | Toda mutación queda registrada con user, ip, diff | 3 | `feature/NX-P2-014-audit-logs` | 011 |
| 15 | NX-P2-015 | Rate limiting por tenant + por IP (Redis) | 100 req/min por usuario, 10/min en login | 2 | `feature/NX-P2-015-rate-limit` | P1-002 |
| 16 | NX-P2-016 | Endpoints de admin global (super-admin) | `/admin/tenants` CRUD; protegido por SUPERADMIN | 3 | `feature/NX-P2-016-superadmin` | 011 |

**Total P2:** ~63 SP

### 👤 Persona 3 — Backend Módulos de Negocio

> Trabaja en paralelo desde la semana 2 contra un mock del TenantContext mientras P2 termina NX-P2-005. Desde la semana 3 ya consume el contexto real.

| Orden local | ID | Tarea | Criterios de Aceptación | SP | Rama | Dep. |
|---|---|---|---|---|---|---|
| 1 | NX-P3-001 | Schema Prisma: categories, products, warehouses | Migración con índices; `UNIQUE(tenant_id, sku)` | 3 | `feature/NX-P3-001-products-schema` | P2-002 |
| 2 | NX-P3-002 | CRUD Categorías (con jerarquía) | Crear/editar/borrar (soft); evita ciclos en parent_id; lista en árbol | 3 | `feature/NX-P3-002-categories-crud` | 001, P2-010 |
| 3 | NX-P3-003 | CRUD Productos + búsqueda fuzzy + filtros | Paginación cursor; búsqueda por SKU/nombre con `pg_trgm`; filtro por categoría | 5 | `feature/NX-P3-003-products-crud` | 001, P2-010 |
| 4 | NX-P3-004 | Schema Prisma: inventory + stock_movements | Migración; constraint quantity ≥ 0 | 2 | `feature/NX-P3-004-inventory-schema` | 001 |
| 5 | NX-P3-005 | Servicio de Inventario (entrada/salida/ajuste) | Movimientos transaccionales; bloqueo optimista; auditados | 5 | `feature/NX-P3-005-inventory-service` | 004, P2-014 |
| 6 | NX-P3-006 | Endpoint de inventario por almacén + alertas de min_stock | Listado paginado; campo `is_low_stock` calculado | 3 | `feature/NX-P3-006-inventory-endpoints` | 005 |
| 7 | NX-P3-007 | Schema Prisma: customers | Migración + índices | 1 | `feature/NX-P3-007-customers-schema` | P2-002 |
| 8 | NX-P3-008 | CRUD Clientes | Validación tax_id por país; búsqueda por nombre/tax_id | 3 | `feature/NX-P3-008-customers-crud` | 007, P2-010 |
| 9 | NX-P3-009 | Schema Prisma: sales + sale_items + invoices | Migración; folio `number` por secuencia por tenant | 3 | `feature/NX-P3-009-sales-schema` | P2-002 |
| 10 | NX-P3-010 | Servicio de Ventas (creación atómica con descuento de stock) | Transacción única: crea sale + items + decrementa inventory + registra movements; rollback si stock insuficiente | 8 | `feature/NX-P3-010-sales-service` | 005, 008, 009 |
| 11 | NX-P3-011 | Confirmación / cancelación de venta + devolución de stock | Cancelar venta confirmada repone stock vía movement REVERSE | 5 | `feature/NX-P3-011-sales-lifecycle` | 010 |
| 12 | NX-P3-012 | Generación de factura PDF (PDFKit) + upload a MinIO | PDF con datos del tenant; URL firmada de descarga desde MinIO | 5 | `feature/NX-P3-012-invoice-pdf` | 010, P1-011 |
| 13 | NX-P3-013 | Endpoint de dashboard (KPIs) | Respuesta cacheada 5 min en Redis; invalidada por ventas/movimientos | 5 | `feature/NX-P3-013-dashboard-api` | 010, 006 |
| 14 | NX-P3-014 | Tests de integración de venta (concurrencia + aislamiento) | 2 ventas concurrentes no producen stock negativo; tenant A no ve ventas de B | 5 | `feature/NX-P3-014-sales-tests` | 010 |
| 15 | NX-P3-015 | Endpoints de reportes (CSV export ventas, inventario) | Stream de CSV; respeta permisos `reports:export` | 3 | `feature/NX-P3-015-reports` | 010 |

**Total P3:** ~59 SP

### 👤 Persona 4 — Frontend & UX

| Orden local | ID | Tarea | Criterios de Aceptación | SP | Rama | Dep. |
|---|---|---|---|---|---|---|
| 1 | NX-P4-001 | Bootstrap Next.js 14 + Tailwind + shadcn/ui | `pnpm dev` levanta web; layout base con sidebar; tema claro/oscuro | 3 | `feature/NX-P4-001-next-bootstrap` | P1-001 |
| 2 | NX-P4-002 | Cliente API (TanStack Query + axios + interceptor de tenant) | Header `X-Tenant-Slug` automático; refresh de token transparente | 3 | `feature/NX-P4-002-api-client` | 001, P2-003 |
| 3 | NX-P4-003 | Middleware Next.js: extracción de subdominio | `empresa1.lvh.me` setea cookie tenant; `app.lvh.me` muestra app de admin global | 3 | `feature/NX-P4-003-subdomain-mw` | 001 |
| 4 | NX-P4-004 | Mocks con MSW para desarrollo desacoplado | MSW intercepta `/auth/login` y `/products` con fixtures | 3 | `feature/NX-P4-004-msw-mocks` | 002 |
| 5 | NX-P4-005 | Pantalla de signup (registro de tenant) | Formulario validado con Zod; crea tenant y redirige a `<slug>.lvh.me:3000` | 3 | `feature/NX-P4-005-signup-page` | 002, P2-007 |
| 6 | NX-P4-006 | Pantalla de login | RHF + Zod; manejo de errores; "remember me" | 2 | `feature/NX-P4-006-login-page` | 002, P2-008 |
| 7 | NX-P4-007 | Layout autenticado: sidebar + topbar + selector usuario | Roles ocultan items del menú; logout funcional | 3 | `feature/NX-P4-007-app-layout` | 006 |
| 8 | NX-P4-008 | Página Productos: lista con búsqueda, filtros, paginación | TanStack Table; debounce 300ms; URL refleja filtros | 5 | `feature/NX-P4-008-products-list` | 007, P3-003 |
| 9 | NX-P4-009 | Modal/drawer de creación y edición de producto | Validación Zod; optimistic update; toast de feedback | 3 | `feature/NX-P4-009-product-form` | 008 |
| 10 | NX-P4-010 | Página Categorías (árbol drag & drop) | Reordenar; crear subcategoría inline | 3 | `feature/NX-P4-010-categories-tree` | 007, P3-002 |
| 11 | NX-P4-011 | Página Clientes: CRUD + búsqueda | Tabla + formulario; validación tax_id | 3 | `feature/NX-P4-011-customers-page` | 007, P3-008 |
| 12 | NX-P4-012 | Página Inventario: stock por producto/almacén + ajustes | Acción "Ajustar stock" abre modal; histórico de movimientos visible | 5 | `feature/NX-P4-012-inventory-page` | 007, P3-006 |
| 13 | NX-P4-013 | Página Nueva Venta (POS-like) | Buscador de productos por SKU/nombre; carrito; selector cliente; descuentos; total reactivo | 8 | `feature/NX-P4-013-new-sale` | 007, P3-010 |
| 14 | NX-P4-014 | Página Ventas: listado + detalle + descarga de factura | Estados con badges; descarga del PDF desde MinIO | 5 | `feature/NX-P4-014-sales-list` | 013, P3-012 |
| 15 | NX-P4-015 | Dashboard: KPIs + gráficas (Recharts) | Ventas del mes, top productos, alertas de stock | 5 | `feature/NX-P4-015-dashboard` | 007, P3-013 |
| 16 | NX-P4-016 | Página de Configuración (perfil, usuarios del tenant, roles) | Owner gestiona usuarios; cambio de password con confirmación | 5 | `feature/NX-P4-016-settings` | 007, P2-013 |
| 17 | NX-P4-017 | Tests E2E con Playwright (flujo crítico: signup → producto → venta) | 5 escenarios pasan en CI; capturas en fallos | 5 | `feature/NX-P4-017-e2e-tests` | 014 |
| Continuo | NX-P4-018 | Accesibilidad (a11y): teclado, ARIA, contraste | Lighthouse a11y ≥ 90; navegación con teclado completa | 3 | `feature/NX-P4-018-a11y` | continuo |

**Total P4:** ~70 SP

---

## 7️⃣ Orden Global de Ejecución y Cronograma

### 7.1 Cronograma Día por Día (8 semanas = 40 días hábiles)

> Cada celda indica las tareas activas en ese día por cada persona. **Tareas en negrita son bloqueantes** para otros tracks: si se atrasan, hay que reasignar recursos. _Cursivas_ indican trabajo de apoyo o estudio.

#### **Semana 1 — Cimientos**

| Día | P1 (DevOps) | P2 (Core) | P3 (Negocio) | P4 (Frontend) |
|---|---|---|---|---|
| 1 | **NX-P1-001** | _Pareando con P1_ | _Estudio dominio + ER_ | _Diseño UI + wireframes_ |
| 2 | **NX-P1-001** | _Review NX-P1-001_ | _Wireframes + fixtures_ | _Wireframes + fixtures_ |
| 3 | **NX-P1-002**, NX-P1-003 | _Pareando con P1_ | _Estudio Prisma_ | _Estudio Next.js_ |
| 4 | NX-P1-002, NX-P1-003 | **NX-P2-001** | _Estudio dominio_ | _Estudio Next.js_ |
| 5 | NX-P1-004, NX-P1-005 | NX-P2-001, **NX-P2-002** | _Pareando con P2_ | **NX-P4-001** |

**Hito viernes semana 1:** `docker compose up` funciona, web y api responden, CI corre en cada PR.

#### **Semana 2 — Esqueleto + Contrato API**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 6 | NX-P1-005, NX-P1-006 | NX-P2-002, **NX-P2-003** | _Mock TenantContext_ | NX-P4-001, **NX-P4-002** |
| 7 | NX-P1-006, NX-P1-008 | NX-P2-003, **NX-P2-004** | NX-P3-001 | NX-P4-002, NX-P4-003 |
| 8 | NX-P1-008, NX-P1-010 | **NX-P2-004** | NX-P3-001, NX-P3-002 (mock) | NX-P4-003, NX-P4-004 |
| 9 | NX-P1-011 (MinIO), NX-P1-015 | _Review NX-P2-004_, **NX-P2-005** | NX-P3-002, NX-P3-004 | NX-P4-004 |
| 10 | NX-P1-007 (staging), NX-P1-014 | **NX-P2-005**, NX-P2-006 | NX-P3-004, NX-P3-007 | NX-P4-004 review |

**Hito viernes semana 2:** RLS verificado por tests, OpenAPI publicado, frontend con MSW funcional. **Contrato API congelado** (cambios requieren PR explícito).

#### **Semana 3 — Auth + Productos backend**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 11 | NX-P1-009 (GlitchTip opcional), NX-P1-012 (backups) | **NX-P2-007** (signup) | **NX-P3-003** (CRUD products) | NX-P4-005 (signup UI) |
| 12 | NX-P1-012 | NX-P2-007, **NX-P2-008** (login) | NX-P3-003 | NX-P4-005, NX-P4-006 |
| 13 | NX-P1-014 (docs) | NX-P2-008, NX-P2-009 | _Review NX-P3-003_ | **NX-P4-006**, NX-P4-007 |
| 14 | _Buffer / soporte_ | **NX-P2-010** (guards) | NX-P3-005 (inventory svc) | NX-P4-007 |
| 15 | _Buffer / soporte_ | NX-P2-010, **NX-P2-012** (tests) | NX-P3-005 | NX-P4-008 (products UI) |

**Hito viernes semana 3:** signup + login funcional end-to-end, productos persistidos con RLS, tests de aislamiento pasando.

#### **Semana 4 — RBAC + Inventario backend + Productos UI**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 16 | _Buffer_ | **NX-P2-011** (RBAC) | NX-P3-005, NX-P3-006 | NX-P4-008 |
| 17 | _Buffer_ | NX-P2-011 | NX-P3-006, NX-P3-008 (customers) | NX-P4-008, NX-P4-009 |
| 18 | NX-P1-013 (prod stack inicial) | NX-P2-013 (invites) | NX-P3-008 | NX-P4-009, NX-P4-010 |
| 19 | NX-P1-013 | NX-P2-014 (audit) | NX-P3-009 (sales schema) | NX-P4-010 |
| 20 | NX-P1-013 | NX-P2-015 (rate limit) | **NX-P3-010** (sales service) | NX-P4-011 (customers UI) |

**Hito viernes semana 4 (mitad del proyecto):** RBAC operativo, módulos de productos/inventario/clientes funcionales en backend y UI. **Demo formal al equipo.**

#### **Semana 5 — Ventas backend + Inventario UI**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 21 | _Review NX-P1-013_ | NX-P2-016 (superadmin) | **NX-P3-010** | NX-P4-011, **NX-P4-012** (inventory UI) |
| 22 | _Soporte CI_ | NX-P2-016 | NX-P3-010 | NX-P4-012 |
| 23 | _Soporte CI_ | _Buffer / pareando con P3_ | _Review NX-P3-010_ | NX-P4-012 |
| 24 | _Soporte CI_ | _Buffer_ | NX-P3-011 (lifecycle) | _Buffer / soporte UI_ |
| 25 | _Soporte CI_ | _Buffer_ | **NX-P3-012** (PDF facturas) | _Buffer_ |

**Hito viernes semana 5:** ventas se crean atómicamente, factura PDF generada y guardada en MinIO.

#### **Semana 6 — Ventas UI + Dashboard backend**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 26 | _Hardening backups_ | _Code review intensivo P3/P4_ | NX-P3-013 (dashboard API) | **NX-P4-013** (Nueva Venta) |
| 27 | _Hardening backups_ | _Code review_ | NX-P3-013 | NX-P4-013 |
| 28 | _Documentación_ | _Code review_ | NX-P3-014 (tests ventas) | NX-P4-013 |
| 29 | _Documentación_ | _Code review_ | NX-P3-014 | _Review NX-P4-013_ |
| 30 | _Documentación_ | _Pareando con P4 en E2E_ | NX-P3-015 (reportes CSV) | NX-P4-014 (lista ventas) |

**Hito viernes semana 6:** se puede registrar una venta completa desde la UI con descuento de stock y descarga de PDF.

#### **Semana 7 — Dashboard UI + Configuración + Reportes**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 31 | _Drill restore BD_ | _Pareando E2E_ | _Review NX-P3-015_ | NX-P4-014, **NX-P4-015** (dashboard) |
| 32 | _Drill restore BD_ | _Pareando E2E_ | _Buffer / refactor_ | NX-P4-015 |
| 33 | NX-P1-013 final | _Pareando E2E_ | _Bug fixing_ | **NX-P4-016** (settings) |
| 34 | NX-P1-013 final | _Bug fixing_ | _Bug fixing_ | NX-P4-016 |
| 35 | _Soporte_ | _Bug fixing_ | _Bug fixing_ | **NX-P4-017** (E2E) |

**Hito viernes semana 7:** **feature freeze**. Solo bugs y pulido a partir de aquí.

#### **Semana 8 — Pulido, E2E, Hardening, Release**

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 36 | _Hardening seguridad_ | _Bug bash_ | _Bug bash_ | NX-P4-017 |
| 37 | _Hardening seguridad_ | _Bug bash_ | _Bug bash_ | NX-P4-017, NX-P4-018 (a11y) |
| 38 | _Setup release_ | _Code freeze + review_ | _Code freeze + review_ | NX-P4-018 |
| 39 | _Tag v1.0.0-rc + smoke tests_ | _Smoke tests_ | _Smoke tests_ | _Smoke tests_ |
| 40 | **Release v1.0.0** | Soporte | Soporte | Soporte |

**Hito viernes semana 8:** **MVP en producción local con tag `v1.0.0`.**

### 7.2 Hitos Críticos (orden cronológico)

| Hito | Día | Bloqueante de | Responsable |
|---|---|---|---|
| H1 — Stack Docker funcional | 5 | Todo el resto | P1 |
| H2 — Schema base + RLS aplicados | 8 | P3 (módulos), P2 (auth) | P2 |
| H3 — Contrato OpenAPI congelado | 10 | P4 (UI integrada) | P2 + P4 |
| H4 — TenantContext operativo | 10 | P3 (deja el mock) | P2 |
| H5 — Auth completo (signup+login) | 13 | P4 (login real) | P2 |
| H6 — Productos en producción local | 15 | P3 (ventas) | P2 + P3 + P4 |
| H7 — RBAC operativo | 17 | Settings UI | P2 |
| H8 — Demo de mitad de proyecto | 20 | Validación con stakeholders | Todo el equipo |
| H9 — Ventas atómicas con PDF | 25 | Dashboard, E2E | P3 |
| H10 — UI venta completa | 30 | Tests E2E | P4 |
| H11 — Feature freeze | 35 | Pulido | Todo el equipo |
| H12 — Release v1.0.0 | 40 | — | P1 |

### 7.3 Reglas del Cronograma

1. **Si un hito crítico se atrasa más de 1 día**, se convoca standup extraordinario y se reasignan tareas no críticas para desbloquear.
2. **Buffer del 20%** ya incluido (semanas 7-8 tienen tareas de pulido sustituibles por bug-fixing si hay deuda técnica acumulada).
3. **Las tareas "Continuo"** (docs, a11y) se reparten en pequeños incrementos durante toda la duración del proyecto, no se posponen al final.
4. **Code review SLA:** ≤4 horas hábiles para PRs no bloqueantes, ≤1 hora para PRs en path crítico.
5. **Una persona nunca trabaja en 2 tareas bloqueantes el mismo día.** Si el cronograma lo sugiere, se prioriza la del hito más cercano.

### 7.4 Resumen de Fases

| Fase | Semanas | Hitos cubiertos | Estado al cierre |
|---|---|---|---|
| **F1 — Cimientos** | 1-2 | H1, H2, H3, H4 | Stack levanta, contrato API congelado, RLS verificado |
| **F2 — Core multi-tenant** | 3-4 | H5, H6, H7, H8 | Auth + módulos básicos integrados front+back, demo a stakeholders |
| **F3 — Módulos de negocio** | 5-7 | H9, H10, H11 | Ventas, dashboard, settings completos, feature freeze |
| **F4 — Pulido y release** | 8 | H12 | E2E pasando, hardening, release v1.0.0 |

### 7.5 Definition of MVP Done

1. ✅ 2+ tenants funcionando en la misma BD sin cruce de datos.
2. ✅ Cobertura de tests ≥ 70% en módulos de negocio y 100% en lógica de aislamiento.
3. ✅ p95 de respuesta API < 300 ms en endpoints críticos (medido en local).
4. ✅ Cero errores en logs durante un smoke test de 30 minutos.
5. ✅ Documentación de onboarding completa: un nuevo desarrollador hace su primer PR en ≤ 1 día.
6. ✅ Backup y restore de BD verificados con drill exitoso.

---

## 📋 Anexos

### A. Comandos Frecuentes

```bash
# Setup inicial (máquina nueva)
make setup                       # instala deps y levanta stack
# o equivalente:
pnpm install
docker compose up -d

# Desarrollo
pnpm dev                         # levanta web + api en paralelo
pnpm --filter api dev            # solo backend
pnpm --filter web dev            # solo frontend
docker compose logs -f api       # logs en vivo

# Base de datos
pnpm --filter api db:migrate     # aplicar migración
pnpm --filter api db:reset       # resetear (solo dev)
pnpm --filter api db:seed        # seeds
docker exec -it nexos-postgres psql -U nexos   # acceso directo

# Backups locales
./scripts/backup.sh              # genera dump en ./backups/YYYY-MM-DD.sql.gz
./scripts/restore.sh ./backups/2026-01-15.sql.gz

# Testing
pnpm test                        # todos los tests
pnpm test:watch
pnpm test:e2e                    # Playwright
pnpm test:coverage

# Calidad
pnpm lint
pnpm typecheck
pnpm format

# Build y deploy local
pnpm build
docker compose -f docker-compose.prod.yml up -d
```

### B. Política de Seguridad (resumen)

- **Secretos:** nunca en git. `.env` siempre gitignored. Usar `.env.example` como referencia. En producción local, los secretos viven solo en la máquina destinada a producción.
- **Contraseñas:** argon2id, mínimo 12 caracteres, validación con `zxcvbn` (score ≥ 3).
- **Headers:** CSP estricta, HSTS si se usa HTTPS local, X-Frame-Options DENY.
- **CORS:** whitelist explícita de subdominios `*.lvh.me` o el dominio local elegido.
- **Validación:** todo input pasa por Zod tanto en cliente como servidor.
- **SQL Injection:** imposible con Prisma; consultas raw deben usar `Prisma.sql` con parámetros.
- **RLS:** revisar policies en cada PR que toque schema (CODEOWNERS lo asigna a P2).

### C. Riesgos Conocidos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Olvido de `tenant_id` en query | Media | Crítico | RLS forzado + tests automatizados |
| JWT comprometido | Baja | Alto | TTL corto + rotación de refresh + revocación en Redis |
| Concurrencia en venta provoca stock negativo | Media | Alto | Transacciones con `SELECT … FOR UPDATE` o constraint CHECK |
| Subdominio mal configurado expone tenant | Baja | Crítico | Test automatizado en CI verifica resolución |
| Equipo sub-estima módulo de ventas | Media | Medio | Buffer en semana 8; spike previo de prototipo |
| Dependencia bloqueante entre P2 y P3 | Alta | Medio | P3 trabaja con mock de TenantContext hasta semana 3 |
| Máquina de "producción local" falla | Media | Alto | Backups diarios + drill de restore en semana 7 |
| Contenedores consumen mucha RAM en dev | Media | Bajo | Documentar en `/docs/troubleshooting.md` cómo apagar servicios opcionales (GlitchTip, Grafana) |

---

**Documento mantenido por el equipo.** Cambios significativos requieren PR con `docs:` y review de al menos 2 personas.