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

const ROLE_ICONS: Record<string, string> = {
  Admin: 'admin_badge',
  User: 'person',
  Farmer: 'agriculture',
  Buyer: 'shopping_bag',
  Inspector: 'verified_user',
  Driver: 'local_shipping',
};

function RoleIcon({ roleName }: { roleName: string }) {
  const icon = ROLE_ICONS[roleName] ?? 'badge';
  return (
    <span className="material-symbols-outlined text-2xl text-[var(--admin-primary)]">
      {icon}
    </span>
  );
}

function RolesAdminPage() {
  const { data: roles, isLoading, isError } = useRoles();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  // roles is an array of role objects with { id, name, description, permissions, createdAt, updatedAt }
  // Access the data field from API response envelope
  const roleList = Array.isArray(roles) ? roles : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">Rôles & Permissions</h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Gérez les rôles et les permissions associées.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {roleList.length === 0 ? (
          <EmptyState />
        ) : (
          roleList.map((role: any) => (
            <div
              key={role.id}
              className="bg-[var(--admin-surface-container-lowest)] rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <RoleIcon roleName={role.name} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                    {role.name}
                  </h2>
                </div>
                <span className="text-xs text-[var(--admin-on-surface-variant)] font-medium whitespace-nowrap">
                  {role.permissions?.length ?? 0} permission{(role.permissions?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              {role.description && (
                <p className="text-sm text-[var(--admin-on-surface-variant)] mb-4 ml-11">
                  {role.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 ml-11">
                {(role.permissions ?? []).map((perm: string) => (
                  <span
                    key={perm}
                    className="inline-flex items-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)] px-2.5 py-0.5 text-xs font-medium"
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

function LoadingState() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-48 bg-[var(--admin-surface-container)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--admin-surface-container-low)] rounded mt-2 animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[var(--admin-surface-container-lowest)] rounded-xl p-6 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[var(--admin-surface-container)] rounded" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-[var(--admin-surface-container)] rounded" />
              </div>
              <div className="h-4 w-24 bg-[var(--admin-surface-container)] rounded" />
            </div>
            <div className="h-4 w-full bg-[var(--admin-surface-container-low)] rounded mb-4 ml-11" />
            <div className="flex gap-1.5 ml-11">
              <div className="h-5 w-20 bg-[var(--admin-surface-container)] rounded-full" />
              <div className="h-5 w-28 bg-[var(--admin-surface-container)] rounded-full" />
              <div className="h-5 w-16 bg-[var(--admin-surface-container)] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">Rôles & Permissions</h1>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          Gérez les rôles et les permissions associées.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 bg-[var(--admin-surface-container-lowest)] rounded-xl">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)] mb-4">
          error_outline
        </span>
        <p className="text-[var(--admin-on-surface)] text-lg font-medium mb-1">
          Erreur de chargement
        </p>
        <p className="text-[var(--admin-on-surface-variant)] text-sm">
          Impossible de récupérer la liste des rôles.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[var(--admin-surface-container-lowest)] rounded-xl p-12 text-center">
      <span className="material-symbols-outlined text-5xl text-[var(--admin-on-surface-variant)] mb-4 block">
        badge
      </span>
      <p className="text-[var(--admin-on-surface-variant)] text-sm">
        Aucun rôle trouvé.
      </p>
    </div>
  );
}
