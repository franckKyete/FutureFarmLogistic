import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import { useRoles } from '@/features/admin/api/users.queries';

export const Route = createFileRoute('/admin/roles')({
  beforeLoad: () => {
    requireAuth(Permission.ROLE_READ);
  },
  component: RolesAdminPage,
});

function RolesAdminPage() {
  const { data: roles, isLoading, isError } = useRoles();

  if (isLoading) {
    return <div className="text-gray-400 p-6">Chargement...</div>;
  }

  if (isError) {
    return <div className="text-red-500 p-6">Erreur lors du chargement des rôles.</div>;
  }

  // roles is an array of role objects with { id, name, description, permissions, createdAt, updatedAt }
  // Access the data field from API response envelope
  const roleList = Array.isArray(roles) ? roles : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rôles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les rôles et les permissions associées.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {roleList.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center text-gray-400 text-sm">
            Aucun rôle trouvé.
          </div>
        ) : (
          roleList.map((role: any) => (
            <div key={role.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">{role.name}</h2>
                <span className="text-xs text-gray-400">{role.permissions?.length ?? 0} permissions</span>
              </div>
              {role.description && (
                <p className="text-sm text-gray-500 mb-3">{role.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(role.permissions ?? []).map((perm: string) => (
                  <span
                    key={perm}
                    className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
