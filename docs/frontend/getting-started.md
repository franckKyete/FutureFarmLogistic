# Frontend — Getting Started

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- API running at `http://localhost:3000` (see [Backend Getting Started](../backend/getting-started.md))

## Local Setup

```bash
# 1. Install dependencies from monorepo root
pnpm install

# 2. Copy env vars
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:3000/v1

# 3. Start the dev server
pnpm --filter @futurefarm/web dev
```

App available at: `http://localhost:3001`

## Common Commands

```bash
# Run unit tests
pnpm --filter @futurefarm/web test

# Run tests in watch mode
pnpm --filter @futurefarm/web test:watch

# Type-check
pnpm --filter @futurefarm/web type-check

# Build for production
pnpm --filter @futurefarm/web build
```
