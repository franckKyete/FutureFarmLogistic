import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, UserStatus } from '@futurefarm/types';
import { useUsers, useUpdateUserStatus } from '@/features/admin/api/users.queries';
import type { AdminUserDto } from '@/features/admin/types';

export const Route = createFileRoute('/admin/users')({
  beforeLoad: () => {
    requireAuth(Permission.USER_READ);
  },
  component: UsersListPage,
});

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.APPROVED]: 'Actif',
  [UserStatus.SUSPENDED]: 'Inactif',
  [UserStatus.PENDING_VALIDATION]: 'En attente',
  [UserStatus.BANNED]: 'Banni',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  [UserStatus.APPROVED]: 'bg-green-50 text-green-700 ring-green-600/20',
  [UserStatus.SUSPENDED]: 'bg-red-50 text-red-700 ring-red-600/20',
  [UserStatus.PENDING_VALIDATION]: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  [UserStatus.BANNED]: 'bg-red-100 text-red-800 ring-red-600/30',
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

type SortField = 'firstName' | 'email' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

function useSort() {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggle = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return { sortField, sortDir, toggle };
}

function sortUsers(users: AdminUserDto[], field: SortField, dir: SortDir): AdminUserDto[] {
  return [...users].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'firstName': {
        const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
        cmp = aName.localeCompare(bName);
        break;
      }
      case 'email':
        cmp = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return <span className="material-symbols-outlined text-gray-300 text-base ml-1">unfold_more</span>;
  }
  return (
    <span className="material-symbols-outlined text-brand-600 text-base ml-1">
      {sortDir === 'asc' ? 'expand_less' : 'expand_more'}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] ?? 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
      {role}
    </span>
  );
}

function ActionsDropdown({
  user,
  onStatusChange,
}: {
  user: AdminUserDto;
  onStatusChange: (id: string, status: UserStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  const isActive = user.status === UserStatus.APPROVED;
  const isSuspended = user.status === UserStatus.SUSPENDED;
  const isPending = user.status === UserStatus.PENDING_VALIDATION;

  const handleAction = (newStatus: UserStatus) => {
    onStatusChange(user.id, newStatus);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center rounded-md bg-white p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        aria-label="Actions"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 py-1">
            {isPending && (
              <button
                type="button"
                onClick={() => handleAction(UserStatus.APPROVED)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-green-600">check_circle</span>
                Activer
              </button>
            )}
            {isActive && (
              <button
                type="button"
                onClick={() => handleAction(UserStatus.SUSPENDED)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-red-600">cancel</span>
                Désactiver
              </button>
            )}
            {(isSuspended || isPending) && (
              <button
                type="button"
                onClick={() => handleAction(UserStatus.APPROVED)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-green-600">check_circle</span>
                Réactiver
              </button>
            )}
            {isSuspended && (
              <button
                type="button"
                onClick={() => handleAction(UserStatus.BANNED)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">block</span>
                Bannir
              </button>
            )}
            {!isPending && !isActive && !isSuspended && (
              <div className="px-4 py-2 text-xs text-gray-400">Aucune action disponible</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UsersListPage() {
  const { data: users, isLoading, isError, refetch } = useUsers();
  const updateStatus = useUpdateUserStatus();
  const queryClient = useQueryClient();
  const { sortField, sortDir, toggle } = useSort();

  const handleStatusChange = (id: string, newStatus: UserStatus) => {
    updateStatus.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin h-8 w-8 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        <span className="ml-3 text-sm text-gray-500">Chargement des utilisateurs...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">error_outline</span>
        <p className="text-sm text-red-600 mb-4">Erreur lors du chargement des utilisateurs.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Réessayer
        </button>
      </div>
    );
  }

  const userList = Array.isArray(users) ? users : [];
  const sortedUsers = sortUsers(userList, sortField, sortDir);

  if (userList.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez les comptes utilisateurs de la plateforme.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm py-24">
          <span className="material-symbols-outlined text-[64px] text-gray-300 mb-4">person_off</span>
          <p className="text-sm text-gray-400">Aucun utilisateur trouvé.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
        <p className="mt-1 text-sm text-gray-500">
          {userList.length} utilisateur{userList.length > 1 ? 's' : ''} sur la plateforme.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
                onClick={() => toggle('firstName')}
              >
                <div className="inline-flex items-center">
                  <span className="material-symbols-outlined text-base mr-1.5">person</span>
                  Nom
                  <SortIcon field="firstName" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
                onClick={() => toggle('email')}
              >
                <div className="inline-flex items-center">
                  <span className="material-symbols-outlined text-base mr-1.5">email</span>
                  Email
                  <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="inline-flex items-center">
                  <span className="material-symbols-outlined text-base mr-1.5">badge</span>
                  Rôles
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
                onClick={() => toggle('status')}
              >
                <div className="inline-flex items-center">
                  <span className="material-symbols-outlined text-base mr-1.5">circle</span>
                  Statut
                  <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
                onClick={() => toggle('createdAt')}
              >
                <div className="inline-flex items-center">
                  <span className="material-symbols-outlined text-base mr-1.5">calendar_month</span>
                  Inscription
                  <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      {user.firstName.charAt(0).toUpperCase()}
                      {user.lastName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {user.phone ?? '—'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {user.email}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => <RoleBadge key={role.id} role={role.name} />)
                    ) : (
                      <span className="text-xs text-gray-400">Aucun rôle</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <ActionsDropdown user={user} onStatusChange={handleStatusChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {updateStatus.isPending && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin h-4 w-4 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Mise à jour en cours...
        </div>
      )}
    </div>
  );
}
