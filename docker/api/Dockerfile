# =============================================================================
# API — Multi-stage Dockerfile
# Stage 1: Build  |  Stage 2: Production
# =============================================================================

# ---- Base ----
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ---- Builder ----
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./
RUN pnpm --filter @futurefarm/types build
RUN pnpm --filter @futurefarm/api build

# ---- Production ----
FROM node:20-alpine AS production
RUN npm install -g pnpm@9
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
