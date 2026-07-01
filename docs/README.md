# Future Farm Logistic — Documentation

Welcome to the Future Farm Logistic platform documentation. This monorepo contains the full-stack codebase for the platform.

## Table of Contents

### Architecture
- [Overview](./architecture/overview.md) — System diagram, tech stack, and ADR log
- [Monorepo](./architecture/monorepo.md) — Workspace layout and Turborepo pipelines
- [RBAC](./architecture/rbac.md) — Permission system design and guard flow

### Backend (`apps/api`)
- [Getting Started](./backend/getting-started.md) — Local dev setup
- [API Conventions](./backend/api-conventions.md) — URL structure, versioning, response shapes
- [Notifications](./backend/notifications.md) — Multi-channel notification architecture
- [Modules](./backend/modules.md) — How to create a new NestJS module
- [Auth](./backend/auth.md) — JWT flow, token refresh, guard usage

### Frontend (`apps/web`)
- [Getting Started](./frontend/getting-started.md) — Local dev setup
- [Routing](./frontend/routing.md) — TanStack Router conventions and route guards
- [Data Fetching](./frontend/data-fetching.md) — TanStack Query patterns
- [Permissions](./frontend/permissions.md) — `usePermissions` hook and `PermissionGate`

### Shared Packages
- [Types](./packages/types.md) — How to add/update shared types and DTOs

### Infrastructure
- [Docker](./infrastructure/docker.md) — Local and production docker-compose usage
- [Environment Variables](./infrastructure/environment-variables.md) — All env vars reference

### Contributing
- [Code Style](./contributing/code-style.md) — ESLint, Prettier, TypeScript rules
- [Git Workflow](./contributing/git-workflow.md) — Branching strategy and PR conventions
