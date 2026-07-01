# RBAC — Permission System

## Model

The RBAC system is **permission-based**. Roles are only named bundles of permissions — they have no special meaning to the guards.

```
Permission (enum in @futurefarm/types)
    ↓ collected into
Role { name, permissions[] }
    ↓ assigned to
User { roles[] }
    ↓ flattened into
JWT payload { permissions[] }
    ↓ checked by
PermissionsGuard on every request
```

## Permission Enum

All permissions live in `packages/types/src/rbac.types.ts`. The format is `resource:action`.

```typescript
export enum Permission {
  USER_READ    = 'user:read',
  USER_CREATE  = 'user:create',
  // ...
}
```

**Adding a new permission**: Add the entry to the enum. The guard automatically enforces it when you decorate a controller action.

## Protecting an Endpoint

```typescript
// Any controller action
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.USER_UPDATE)
@Patch(':id')
update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
  return this.usersService.update(id, dto);
}
```

`JwtAuthGuard` validates the token and attaches the user to the request.  
`PermissionsGuard` reads the `@RequirePermissions()` metadata and checks it against `request.user.permissions`.

## Guard Flow

```
Request
  └── JwtAuthGuard
        ├── Invalid/missing token → 401 Unauthorized
        └── Valid token → attaches AuthUser to request
              └── PermissionsGuard
                    ├── No @RequirePermissions() → allow (public after JWT)
                    └── Has @RequirePermissions()
                          ├── User has all required perms → allow
                          └── Missing any perm → 403 Forbidden
```

## Client-side Permission Checks

```typescript
const { can, canAll, canAny } = usePermissions();

// Show a button only if the user can create users
{can(Permission.USER_CREATE) && <Button>Add User</Button>}

// Redirect if missing required permission
{!can(Permission.ROLE_MANAGE) && <Navigate to="/" />}
```
