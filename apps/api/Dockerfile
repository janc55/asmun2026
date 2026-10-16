# ==========================================
# ASMUN Control - API Dockerfile Multi-Stage
# ==========================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

# Etapa 1: Instalación y Compilación
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --trust-lockfile --filter @asmun/api...

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

RUN pnpm --filter @asmun/api prisma:generate

COPY apps/api/src ./apps/api/src/

RUN pnpm --filter @asmun/api build

# Etapa 2: Imagen de Ejecución Ligera
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar dependencias y artefactos de compilación
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh && \
    chown -R nestjs:nodejs /app

USER nestjs
WORKDIR /app/apps/api

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
