# Adding / Updating Shared Types

The `@futurefarm/types` package is the **API contract** shared between the backend and frontend.

## When to add types here

- A new API resource is introduced (new module in `apps/api`)
- A DTO needs to be consumed by the frontend
- A new permission is added to the RBAC system

## Steps

### 1. Add your type

```typescript
// packages/types/src/my-resource.types.ts
export interface MyResource {
  id: string;
  name: string;
  createdAt: string;
}
```

### 2. Export from the barrel

```typescript
// packages/types/src/index.ts
export * from './my-resource.types';
```

### 3. Rebuild the package

```bash
pnpm --filter @futurefarm/types build
```

### 4. Use in both apps

**Backend** (`apps/api`):
```typescript
import type { MyResource } from '@futurefarm/types';
```

**Frontend** (`apps/web`):
```typescript
import type { MyResource } from '@futurefarm/types';
```

> [!TIP]
> In development with path aliases configured, both apps resolve `@futurefarm/types` directly from the TypeScript source (`src/index.ts`) without needing a build step.
