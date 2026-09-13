# Backend — Getting Started

## Prerequisites

- Bun >= 1.1
- Docker + Docker Compose (for PostgreSQL)

## Local Setup

```bash
# 1. Install dependencies from monorepo root
bun install

# 2. Copy env vars and fill in your values
cp .env.example .env

# 3. Start PostgreSQL
docker-compose up db -d

# 4. Run database migrations
bun --filter @futurefarm/api migration:run

# 5. Start the API in watch mode
bun --filter @futurefarm/api dev
```

API is available at: `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api/docs`  
Health check: `http://localhost:3000/health`

## Common Commands

```bash
# Generate a new migration
bun --filter @futurefarm/api migration:generate src/database/migrations/MigrationName

# Revert the last migration
bun --filter @futurefarm/api migration:revert

# Run unit tests
bun --filter @futurefarm/api test

# Run e2e tests (requires running DB)
bun --filter @futurefarm/api test:e2e

# Build for production
bun --filter @futurefarm/api build
```
