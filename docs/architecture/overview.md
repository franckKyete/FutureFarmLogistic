# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                 │
│          React SPA (apps/web) — port 3001           │
│    TanStack Router · TanStack Query · TailwindCSS   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (REST) + JWT
┌──────────────────────▼──────────────────────────────┐
│              NestJS API (apps/api) — port 3000       │
│   REST Controllers · Guards · Interceptors · Pipes  │
│              URI Versioning: /v1/...                 │
└──────────────────────┬──────────────────────────────┘
                       │ TypeORM
┌──────────────────────▼──────────────────────────────┐
│              PostgreSQL 16 — port 5432               │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Routing | TanStack Router v1 |
| Data fetching | TanStack Query v5 |
| Client state | TanStack Store |
| Styling | TailwindCSS v4 |
| Backend | NestJS, TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens) |
| Monorepo | pnpm workspaces + Turborepo |
| Containers | Docker + Docker Compose |

## Architectural Decisions Log (ADL)

| # | Decision | Rationale |
|---|---|---|
| 1 | Permission-based RBAC (not role-based) | Guards check permissions, not role names. Roles can evolve without touching guards. |
| 2 | Shared `@futurefarm/types` package | Enforces API contract at the TypeScript level across both apps. |
| 3 | TanStack-first frontend | Cohesive ecosystem; Router + Query + Store share design patterns. |
| 4 | TypeORM with PostgreSQL | Decorator-based, native TypeScript, fits NestJS DI model well. |
| 5 | URI versioning (`/v1/...`) | Simple, explicit, does not rely on headers or content negotiation. |
| 6 | Turborepo for task orchestration | Per-package caching and dependency-aware pipeline without Nx overhead. |
