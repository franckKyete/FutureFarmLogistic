import { createFileRoute, redirect } from '@tanstack/react-router';
import { authStore } from '@/features/auth/store/auth.store';
import { findRoleHomepage } from '@/features/auth/utils/role-guard';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!authStore.state.isAuthenticated) {
      throw redirect({ to: '/auth/login' });
    }
    const homepage = findRoleHomepage(authStore.state.user?.roles ?? []);
    throw redirect({ to: homepage });
  },
  component: () => null,
});
