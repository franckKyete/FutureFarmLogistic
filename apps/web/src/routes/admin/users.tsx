import { createFileRoute, redirect } from '@tanstack/react-router';
import { Permission } from '@futurefarm/types';
import { authStore } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/admin/users')({
  beforeLoad: () => {
    if (!authStore.state.isAuthenticated) {
      throw redirect({ to: '/auth/login' });
    }
    const user = authStore.state.user;
    if (!user?.permissions.includes(Permission.USER_READ)) {
      throw redirect({ to: '/' });
    }
  },
  component: UsersAdminPage,
});

function UsersAdminPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">Manage platform users and their roles.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          + Invite User
        </button>
      </div>

      {/* Placeholder table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 text-sm text-gray-400 italic">
          Connect to <code className="bg-gray-100 px-1 rounded">GET /v1/users</code> to populate this table.
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Roles</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                No users yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
