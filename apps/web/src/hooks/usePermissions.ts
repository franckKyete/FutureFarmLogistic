import { useAuthStore } from '@/features/auth/store/auth.store';
import type { Permission } from '@futurefarm/types';

/**
 * Hook that provides permission check helpers based on the current user's permissions.
 *
 * @example
 * const { can, canAll, canAny } = usePermissions();
 *
 * can(Permission.USER_READ)            // true if user has this permission
 * canAll(Permission.USER_READ, Permission.USER_CREATE) // true if user has ALL
 * canAny(Permission.USER_READ, Permission.ROLE_READ)   // true if user has ANY
 */
const EMPTY_PERMISSIONS: Permission[] = [];

export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? EMPTY_PERMISSIONS);

  const can = (permission: Permission): boolean => permissions.includes(permission);

  const canAll = (...required: Permission[]): boolean =>
    required.every((p) => permissions.includes(p));

  const canAny = (...required: Permission[]): boolean =>
    required.some((p) => permissions.includes(p));

  return { can, canAll, canAny, permissions };
}
