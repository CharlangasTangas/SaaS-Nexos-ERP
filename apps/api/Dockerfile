# ─── Stage 1: Base ────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ─── Stage 2: Pruner ──────────────────────────────────────────────────────────
# Turborepo prune genera un subconjunto mínimo del monorepo para esta app
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.2 prune @nexos/api --docker

# ─── Stage 3: Installer ───────────────────────────────────────────────────────
FROM base AS installer
# Copiar archivos de lock del workspace prunado
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ─── Stage 4: Builder ─────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm dlx turbo@2.1.2 run build --filter=@nexos/api

# ─── Stage 5: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    mkdir -p /var/log/nexos && \
    chown -R nestjs:nodejs /var/log/nexos

# Copiar solo los archivos necesarios para producción
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# dumb-init maneja señales correctamente
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
