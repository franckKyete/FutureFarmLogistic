# Backend — Getting Started

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose (for PostgreSQL)

## Local Setup

```bash
# 1. Install dependencies from monorepo root
pnpm install

# 2. Copy env vars and fill in your values
cp .env.example .env

# 3. Start PostgreSQL
docker-compose up db -d

# 4. Run database migrations
pnpm --filter @futurefarm/api migration:run

# 5. Start the API in watch mode
pnpm --filter @futurefarm/api dev
```

API is available at: `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api/docs`  
Health check: `http://localhost:3000/health`

## Common Commands

```bash
# Generate a new migration
pnpm --filter @futurefarm/api migration:generate src/database/migrations/MigrationName

# Revert the last migration
pnpm --filter @futurefarm/api migration:revert

# Run unit tests
pnpm --filter @futurefarm/api test

# Run e2e tests (requires running DB)
pnpm --filter @futurefarm/api test:e2e

# Build for production
pnpm --filter @futurefarm/api build
```
