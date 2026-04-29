# ─── Stage 1: Base ────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ─── Stage 2: Pruner ──────────────────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.2 prune @nexos/web --docker

# ─── Stage 3: Installer ───────────────────────────────────────────────────────
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ─── Stage 4: Builder ─────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# Variables de entorno necesarias para el build de Next.js
ARG API_URL=http://api.lvh.me:4000
ARG ROOT_DOMAIN=lvh.me
ENV NEXT_PUBLIC_API_URL=$API_URL
ENV NEXT_PUBLIC_ROOT_DOMAIN=$ROOT_DOMAIN
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm dlx turbo@2.1.2 run build --filter=@nexos/web

# ─── Stage 5: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache wget

WORKDIR /app

# Usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar standalone output de Next.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
