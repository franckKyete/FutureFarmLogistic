# Frontend — Getting Started

## Prerequisites

- Bun >= 1.1
- API running at `http://localhost:3000` (see [Backend Getting Started](../backend/getting-started.md))

## Local Setup

```bash
# 1. Install dependencies from monorepo root
bun install

# 2. Copy env vars
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:3000/v1

# 3. Start the dev server
bun --filter @futurefarm/web dev
```

App available at: `http://localhost:3001`

## Common Commands

```bash
# Run unit tests
bun --filter @futurefarm/web test

# Run tests in watch mode
bun --filter @futurefarm/web test:watch

# Type-check
bun --filter @futurefarm/web type-check

# Build for production
bun --filter @futurefarm/web build
```
