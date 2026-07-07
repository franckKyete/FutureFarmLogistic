import { redirect } from '@tanstack/react-router';
import { authStore } from '../store/auth.store';
import { addToast } from '@/features/shared/store/toast.store';
import type { Permission } from '@futurefarm/types';

export function requireAuth(requiredPermissions?: Permission | Permission[], mode: 'all' | 'any' = 'all') {
  // Check if authenticated
  if (!authStore.state.isAuthenticated) {
    addToast('Veuillez vous connecter pour accéder à cette page.', 'warning');
    
    const currentPath = window.location.pathname + window.location.search;
    throw redirect({
      to: '/auth/login',
      search: {
        redirect: currentPath,
      },
    });
  }

  // Check permissions if required
  if (requiredPermissions) {
    const userPermissions = authStore.state.user?.permissions ?? [];
    const permissionsToCheck = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    let hasAccess = false;
    if (mode === 'all') {
      hasAccess = permissionsToCheck.every((p) => userPermissions.includes(p));
    } else {
      hasAccess = permissionsToCheck.some((p) => userPermissions.includes(p));
    }

    if (!hasAccess) {
      addToast("Accès refusé : Vous n'avez pas les autorisations requises.", 'error');
      throw redirect({
        to: '/auth/unauthorized',
      });
    }
  }
}
