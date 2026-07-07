import { createFileRoute, redirect } from '@tanstack/react-router';
import { authStore } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!authStore.state.isAuthenticated) {
      throw redirect({ to: '/auth/login' });
    }
    throw redirect({ to: '/farmer/dashboard' });
  },
  component: () => null,
});
