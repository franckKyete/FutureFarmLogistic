# Monorepo Structure

## Workspace Layout

```
futurefarm-apps/
├── apps/
│   ├── api/          # NestJS REST API       (@futurefarm/api)
│   └── web/          # React SPA             (@futurefarm/web)
├── packages/
│   ├── types/        # Shared TS types        (@futurefarm/types)
│   └── config/       # ESLint + TS configs   (@futurefarm/config)
├── docker/           # Dockerfiles + nginx
├── docs/             # This documentation
├── turbo.json        # Turborepo pipeline
├── package.json      # Bun workspaces configuration
└── tsconfig.base.json
```

## Turborepo Pipelines

| Task | Caching | Depends on |
|---|---|---|
| `build` | ✅ Yes | `^build` (upstream packages first) |
| `dev` | ❌ No | — (persistent, parallel) |
| `type-check` | ✅ Yes | `^build` |
| `lint` | ✅ Yes | — |
| `test` | ✅ Yes | `^build` |
| `test:e2e` | ❌ No | `^build` |

## Running Tasks

```bash
# Run all apps in dev mode
bun run dev

# Build everything (respects dependency order)
bun run build

# Type-check all packages
bun run type-check

# Run tests across all packages
bun run test

# Run a task in a specific package only
bun --filter @futurefarm/api dev
bun --filter @futurefarm/web build
```

## Adding a New Package

1. Create `packages/my-package/` with a `package.json` named `@futurefarm/my-package`
2. Add it as a dependency in any app: `"@futurefarm/my-package": "workspace:*"`
3. Run `bun install`
4. Turborepo picks it up automatically — no config changes needed
