import { useAuthStore } from '../store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Convenience hook for reading auth state in components.
 *
 * @example
 * const { user, isAuthenticated } = useAuth();
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { can, canAll, canAny } = usePermissions();

  return { user, isAuthenticated, can, canAll, canAny };
}
