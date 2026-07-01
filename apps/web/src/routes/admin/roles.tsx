import { createFileRoute, redirect } from '@tanstack/react-router';
import { Permission } from '@futurefarm/types';
import { authStore } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/admin/roles')({
  beforeLoad: () => {
    if (!authStore.state.isAuthenticated) {
      throw redirect({ to: '/auth/login' });
    }
    const user = authStore.state.user;
    if (!user?.permissions.includes(Permission.ROLE_READ)) {
      throw redirect({ to: '/' });
    }
  },
  component: RolesAdminPage,
});

// All system permissions displayed for role assignment UI
const ALL_PERMISSIONS = Object.values(Permission);

function RolesAdminPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage roles and the permissions they grant.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          + New Role
        </button>
      </div>

      {/* Permission reference */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Available Permissions</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PERMISSIONS.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
            >
              {perm}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 text-sm text-gray-400 italic">
          Connect to <code className="bg-gray-100 px-1 rounded">GET /v1/roles</code> to populate this list.
        </div>
        <div className="px-6 py-12 text-center text-gray-400 text-sm">
          No roles yet.
        </div>
      </div>
    </div>
  );
}
