import { redirect } from '@tanstack/react-router';
import { authStore } from '../store/auth.store';
import { addToast } from '@/features/shared/store/toast.store';

const ROLE_HOMEPAGE: Record<string, string> = {
  Admin: '/admin/dashboard',
  Farmer: '/farmer/dashboard',
  Inspector: '/inspector/dashboard',
  Buyer: '/marketplace',
};

const ROLE_PRIORITY = ['Admin', 'Farmer', 'Inspector', 'Buyer'] as const;

export function findRoleHomepage(roles: string[]): string {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return ROLE_HOMEPAGE[role]!;
    }
  }
  return '/marketplace';
}

export function requireRole(allowedRoles: string[]): never | void {
  if (!authStore.state.isAuthenticated) {
    throw redirect({ to: '/auth/login' });
  }

  if (!authStore.state.user) {
    throw redirect({ to: '/auth/login' });
  }

  const userRoles = authStore.state.user.roles;
  const hasAccess = allowedRoles.some((r) => userRoles.includes(r));

  if (hasAccess) {
    return;
  }

  addToast("Accès refusé : redirection vers votre espace.", 'warning');
  const homepage = findRoleHomepage(userRoles);
  throw redirect({ to: homepage });
}
