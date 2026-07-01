# =============================================================================
# Web — Multi-stage Dockerfile
# Stage 1: Build (Vite)  |  Stage 2: Production (nginx)
# =============================================================================

# ---- Builder ----
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

RUN pnpm --filter @futurefarm/types build
RUN pnpm --filter @futurefarm/web build

# ---- Production ----
FROM nginx:alpine AS production
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
