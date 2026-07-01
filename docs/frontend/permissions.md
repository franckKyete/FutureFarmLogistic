# Frontend — Permissions

## `usePermissions` hook

```typescript
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@futurefarm/types';

function MyComponent() {
  const { can, canAll, canAny } = usePermissions();

  return (
    <div>
      {/* Show only if user has this permission */}
      {can(Permission.USER_CREATE) && <button>Add User</button>}

      {/* Show only if user has ALL of these */}
      {canAll(Permission.ROLE_CREATE, Permission.ROLE_UPDATE) && (
        <button>Manage Roles</button>
      )}

      {/* Show only if user has ANY of these */}
      {canAny(Permission.USER_READ, Permission.ROLE_READ) && (
        <AdminPanel />
      )}
    </div>
  );
}
```

## `useAuth` hook

Combines auth state + permissions:

```typescript
import { useAuth } from '@/features/auth/hooks/useAuth';

function NavBar() {
  const { user, isAuthenticated, can } = useAuth();

  if (!isAuthenticated) return <LoginButton />;

  return (
    <nav>
      <span>Hello, {user?.firstName}</span>
      {can(Permission.ROLE_MANAGE) && <Link to="/admin/roles">Roles</Link>}
    </nav>
  );
}
```

## Route Guards

To protect a route, check permissions in the `beforeLoad` hook:

```typescript
export const Route = createFileRoute('/admin/users')({
  beforeLoad: ({ context }) => {
    const user = authStore.state.user;
    if (!user?.permissions.includes(Permission.USER_READ)) {
      throw redirect({ to: '/' });
    }
  },
  component: UsersAdminPage,
});
```

## Adding New Permissions

1. Add the permission to `packages/types/src/rbac.types.ts` `Permission` enum
2. Add the permission check to the relevant NestJS controller with `@RequirePermissions()`
3. Use `can(Permission.YOUR_NEW_PERM)` in the UI
