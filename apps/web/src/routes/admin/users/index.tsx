import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, UserStatus } from '@futurefarm/types';
import { useUsers, useUpdateUserStatus } from '@/features/admin/api/users.queries';
import type { AdminUserDto } from '@/features/admin/types';
import {
  StatCard,
  Button,
  AdminCard,
  AdminTable,
  TableFilters,
  AdminTabs,
  SidePanel,
  StatusBadge,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/users/')({
  beforeLoad: () => {
    requireAuth(Permission.USER_READ);
  },
  component: UsersListPage,
});

const ROLE_FRENCH: Record<string, string> = {
  Farmer: 'Producteur',
  Buyer: 'Acheteur',
  Inspector: 'Inspecteur',
  Admin: 'Administrateur',
  Driver: 'Chauffeur',
};

function getFrenchRole(roleName: string): string {
  return ROLE_FRENCH[roleName] ?? roleName;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function getInitials(u: AdminUserDto): string {
  return (u.firstName?.charAt(0) ?? '') + (u.lastName?.charAt(0) ?? '').toUpperCase();
}

function UsersListPage() {
  const { data: users, isLoading } = useUsers();
  const updateStatus = useUpdateUserStatus();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isVerifyPanelOpen, setIsVerifyPanelOpen] = useState(false);
  const [verifyingUser, setVerifyingUser] = useState<AdminUserDto | null>(null);

  // Verification checks state
  const [checks, setChecks] = useState({
    identity: true,
    certificate: true,
    residence: false,
  });

  const itemsPerPage = 10;

  const handleStatusChange = (id: string, newStatus: UserStatus) => {
    updateStatus.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          setIsDetailPanelOpen(false);
          setIsVerifyPanelOpen(false);
        },
      },
    );
  };

  const userList = Array.isArray(users) ? users : [];

  // Metrics
  const totalCount = userList.length;
  const productoresCount = userList.filter((u) => u.roles.some((r) => r.name === 'Farmer')).length;
  const buyersCount = userList.filter((u) => u.roles.some((r) => r.name === 'Buyer')).length;
  const agentsCount = userList.filter((u) => u.roles.some((r) => r.name === 'Inspector' || r.name === 'Driver')).length;
  const pendingCount = userList.filter((u) => u.status === UserStatus.PENDING_VALIDATION).length;

  const filteredUsers = useMemo(() => {
    let result = userList;

    if (activeTab === 'pending') {
      result = result.filter((u) => u.status === UserStatus.PENDING_VALIDATION);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((u) => u.roles.some((r) => r.name === roleFilter));
    }

    if (statusFilter !== 'all') {
      result = result.filter((u) => u.status === statusFilter);
    }

    return result;
  }, [userList, activeTab, searchQuery, roleFilter, statusFilter]);

  // Paginated data
  const totalFiltered = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const tableColumns = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (u: AdminUserDto) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--admin-primary-container)]/10 flex items-center justify-center border border-[var(--admin-primary)]/10 overflow-hidden shrink-0 font-bold text-xs text-[var(--admin-primary)]">
            {getInitials(u)}
          </div>
          <div>
            <p className="font-bold text-[var(--admin-on-surface)]">{u.firstName} {u.lastName}</p>
            <p className="text-[10px] text-[var(--admin-on-surface-variant)] font-medium">ID: #{u.id.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u: AdminUserDto) => (
        <span className="px-3 py-1 bg-[var(--admin-primary-container)]/10 text-[var(--admin-primary)] rounded-full text-[11px] font-bold uppercase tracking-wider">
          {u.roles.map((r) => getFrenchRole(r.name)).join(', ') || 'Utilisateur'}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (u: AdminUserDto) => (
        <div>
          <p className="font-medium text-[var(--admin-on-surface)] text-xs">{u.email}</p>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">{u.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Localisation',
      render: () => (
        <div>
          <p className="text-xs text-[var(--admin-on-surface)] font-medium">Sénégal</p>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">Région de Dakar</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Inscription',
      render: (u: AdminUserDto) => <span className="text-xs text-[var(--admin-on-surface)] font-medium">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (u: AdminUserDto) => {
        const statusMap: Record<UserStatus, string> = {
          [UserStatus.APPROVED]: 'active',
          [UserStatus.SUSPENDED]: 'suspended',
          [UserStatus.PENDING_VALIDATION]: 'pending',
          [UserStatus.BANNED]: 'banned',
        };
        return <StatusBadge status={statusMap[u.status] || 'inactive'} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (u: AdminUserDto) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(u);
              setIsDetailPanelOpen(true);
            }}
            className="p-1.5 hover:bg-[var(--admin-surface-container-high)] rounded-lg text-[var(--admin-on-surface-variant)] transition-all"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
            Gestion des utilisateurs
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
            Contrôlez les accès, validez les nouveaux comptes et gérez les permissions du réseau Future Farm.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="px-6 py-2.5 border border-[var(--admin-outline-variant)]/40 hover:bg-[var(--admin-surface-container-low)]">
            <span className="material-symbols-outlined text-sm">file_download</span>
            Exporter CSV
          </Button>
          <Link to="/admin/users/new">
            <Button
              variant="primary"
              className="bg-[var(--admin-primary)] hover:brightness-110 text-white px-6 py-2.5 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Nouvel agent terrain
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'all', label: 'Tous les utilisateurs', count: totalCount },
          {
            id: 'pending',
            label: 'En attente de validation',
            count: pendingCount,
            countColorClass: pendingCount > 0 ? 'bg-[var(--admin-secondary)]/10 text-[var(--admin-secondary)]' : undefined,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setCurrentPage(1);
        }}
      />

      {activeTab === 'all' ? (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon="group" value={totalCount} label="Total utilisateurs" trend="up" trendLabel="+12%" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
            <StatCard icon="agriculture" value={productoresCount} label="Producteurs" trend="up" trendLabel="+5%" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
            <StatCard icon="shopping_cart" value={buyersCount} label="Acheteurs" trend="up" trendLabel="+8%" iconBgColor="bg-blue-50" iconColor="text-blue-700" />
            <StatCard icon="local_shipping" value={agentsCount} label="Chauffeurs & Agents" trend="down" trendLabel="-2%" iconBgColor="bg-slate-50" iconColor="text-slate-700" />
          </div>

          {/* Filters */}
          <TableFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Recherche par nom, email..."
          >
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-lg text-sm text-[var(--admin-on-surface-variant)] focus:ring-[var(--admin-primary)]/20"
            >
              <option value="all">Tous les rôles</option>
              <option value="Farmer">Producteur</option>
              <option value="Buyer">Acheteur</option>
              <option value="Inspector">Inspecteur</option>
              <option value="Driver">Chauffeur</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-lg text-sm text-[var(--admin-on-surface-variant)] focus:ring-[var(--admin-primary)]/20"
            >
              <option value="all">Tous les statuts</option>
              <option value={UserStatus.APPROVED}>Actif</option>
              <option value={UserStatus.SUSPENDED}>Suspendu</option>
              <option value={UserStatus.BANNED}>Banni</option>
            </select>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-4 py-2 bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-lg text-sm text-[var(--admin-on-surface-variant)] focus:ring-[var(--admin-primary)]/20"
            >
              <option value="all">Pays</option>
              <option value="senegal">Sénégal</option>
              <option value="cote-ivoire">Côte d'Ivoire</option>
            </select>
          </TableFilters>

          {/* Table */}
          <AdminTable
            columns={tableColumns}
            data={paginatedUsers}
            onRowClick={(u) => {
              setSelectedUser(u);
              setIsDetailPanelOpen(true);
            }}
            pagination={{
              currentPage: safePage,
              totalPages,
              totalItems: totalFiltered,
              itemsPerPage,
              onPageChange: handlePageChange,
            }}
          />
        </div>
      ) : (
        /* Validation Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-[var(--admin-on-surface-variant)]/60 bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/40 rounded-xl">
              Aucune candidature en attente de validation.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <AdminCard key={u.id} className="hover:border-[var(--admin-primary)] transition-all group flex flex-col justify-between">
                <div className="p-4 border-b border-[var(--admin-outline-variant)]/30 flex justify-between items-center -mx-6 -mt-6 mb-6">
                  <StatusBadge status="pending" label="Candidature en attente" />
                  <span className="text-[var(--admin-on-surface-variant)]/70 text-[11px] font-medium">Il y a 2h</span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[var(--admin-primary-container)]/10 border border-[var(--admin-primary)]/10 overflow-hidden flex items-center justify-center text-sm font-bold text-[var(--admin-primary)] shrink-0">
                    {getInitials(u)}
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-[var(--admin-primary)]">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {u.roles.map((r) => getFrenchRole(r.name)).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 border-t border-b border-[var(--admin-outline-variant)]/20 py-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--admin-on-surface-variant)] font-medium">Documents fournis</span>
                    <div className="flex gap-1 text-[var(--admin-primary)]">
                      <span className="material-symbols-outlined text-sm font-bold">verified</span>
                      <span className="material-symbols-outlined text-sm font-bold">verified</span>
                      <span className="material-symbols-outlined text-sm text-[var(--admin-outline-variant)]">verified</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--admin-on-surface-variant)] font-medium">Score de fiabilité</span>
                    <span className="font-bold text-[var(--admin-primary)]">82/100</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setVerifyingUser(u);
                    setIsVerifyPanelOpen(true);
                  }}
                  variant="primary"
                  className="w-full bg-[var(--admin-primary)] hover:brightness-110 text-white py-3 rounded-xl font-medium"
                >
                  Examiner le dossier
                </Button>
              </AdminCard>
            ))
          )}
        </div>
      )}

      {/* Slide-out user details panel */}
      <SidePanel
        isOpen={isDetailPanelOpen}
        onClose={() => setIsDetailPanelOpen(false)}
        title="Détails de l'utilisateur"
      >
        {selectedUser && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full bg-[var(--admin-primary-container)]/10 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-[var(--admin-primary)]">person</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--admin-on-surface)]">
                {selectedUser.firstName} {selectedUser.lastName}
              </h3>
              <StatusBadge status={selectedUser.status === UserStatus.APPROVED ? 'active' : 'suspended'} className="mt-2" />
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                Informations de contact
              </h4>
              <div className="space-y-3 text-sm text-[var(--admin-on-surface)]">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--admin-primary)]/60 text-lg">email</span>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--admin-primary)]/60 text-lg">call</span>
                  <span>{selectedUser.phone ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--admin-primary)]/60 text-lg">location_on</span>
                  <span>Sénégal, Dakar</span>
                </div>
              </div>
            </div>

            <hr className="border-[var(--admin-outline-variant)]/30" />

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleStatusChange(selectedUser.id, UserStatus.APPROVED)}
                className="w-full flex items-center justify-between p-3 border border-[var(--admin-outline-variant)]/40 rounded-xl hover:bg-[var(--admin-surface-container-high)] text-sm font-medium"
              >
                <span>Activer / Réactiver le compte</span>
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </button>
              <button
                onClick={() => handleStatusChange(selectedUser.id, UserStatus.SUSPENDED)}
                className="w-full flex items-center justify-between p-3 border border-[var(--admin-outline-variant)]/40 rounded-xl hover:bg-orange-50 text-[var(--admin-secondary)] border-[var(--admin-secondary)]/20 text-sm font-medium"
              >
                <span>Suspendre le compte</span>
                <span className="material-symbols-outlined text-lg">pause_circle</span>
              </button>
              <button
                onClick={() => handleStatusChange(selectedUser.id, UserStatus.BANNED)}
                className="w-full flex items-center justify-between p-3 border border-red-200 rounded-xl hover:bg-red-50 text-[var(--admin-error)] border-red-200/20 text-sm font-medium"
              >
                <span>Bannir l'utilisateur</span>
                <span className="material-symbols-outlined text-lg">gavel</span>
              </button>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Document verification side panel */}
      <SidePanel
        isOpen={isVerifyPanelOpen}
        onClose={() => setIsVerifyPanelOpen(false)}
        title={`Examen du Dossier : ${verifyingUser?.firstName || ''} ${verifyingUser?.lastName || ''}`}
        width="w-[800px]"
      >
        {verifyingUser && (
          <div className="flex h-[calc(100vh-120px)] overflow-hidden">
            {/* Document Viewer (left) */}
            <div className="flex-1 bg-slate-100 p-8 flex flex-col gap-4 overflow-y-auto">
              <div className="flex justify-between items-center text-[var(--admin-on-surface)] text-xs font-semibold mb-2">
                <span>PIÈCE D'IDENTITÉ</span>
                <div className="flex gap-2">
                  <button className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50">
                    <span className="material-symbols-outlined text-base">zoom_in</span>
                  </button>
                  <button className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50">
                    <span className="material-symbols-outlined text-base">rotate_right</span>
                  </button>
                </div>
              </div>
              <div className="w-full aspect-[1.6/1] bg-white rounded-xl border border-[var(--admin-outline-variant)]/40 overflow-hidden shadow-inner flex items-center justify-center p-8">
                <span className="material-symbols-outlined text-6xl text-[var(--admin-outline-variant)]">card_membership</span>
              </div>

              <div className="mt-8 space-y-4">
                <div className="p-4 border-2 border-[var(--admin-primary)] bg-[var(--admin-primary)]/5 rounded-xl flex items-center gap-4">
                  <span className="material-symbols-outlined text-[var(--admin-primary)] text-2xl">verified</span>
                  <div>
                    <p className="text-xs font-bold text-[var(--admin-primary)]">Vérification Automatique OK</p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">Nom et photo correspondent au profil soumis.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Checklist (right) */}
            <div className="w-[300px] border-l border-[var(--admin-outline-variant)]/40 p-6 flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                  Checklist Validation
                </h3>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      checked={checks.identity}
                      onChange={(e) => setChecks({ ...checks, identity: e.target.checked })}
                      className="mt-1 rounded border-[var(--admin-outline-variant)]/60 text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      type="checkbox"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)] transition-colors">
                      Identité valide
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      checked={checks.certificate}
                      onChange={(e) => setChecks({ ...checks, certificate: e.target.checked })}
                      className="mt-1 rounded border-[var(--admin-outline-variant)]/60 text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      type="checkbox"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)] transition-colors">
                      Certificat valide
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      checked={checks.residence}
                      onChange={(e) => setChecks({ ...checks, residence: e.target.checked })}
                      className="mt-1 rounded border-[var(--admin-outline-variant)]/60 text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      type="checkbox"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)] transition-colors">
                      Preuve de résidence
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                <div className="p-4 bg-[var(--admin-secondary-container)]/10 border border-[var(--admin-secondary-container)]/20 rounded-xl">
                  <p className="text-[11px] text-[var(--admin-on-secondary-container)] leading-relaxed font-medium">
                    Note: Le certificat agricole semble expirer dans 3 mois. Prévoir une relance automatique.
                  </p>
                </div>
                <Button
                  onClick={() => handleStatusChange(verifyingUser.id, UserStatus.APPROVED)}
                  variant="primary"
                  className="w-full bg-[var(--admin-primary)] text-white hover:brightness-110"
                >
                  Approuver le compte
                </Button>
                <Button
                  onClick={() => handleStatusChange(verifyingUser.id, UserStatus.SUSPENDED)}
                  variant="secondary"
                  className="w-full border border-red-200 text-[var(--admin-error)] hover:bg-red-50"
                >
                  Rejeter le dossier
                </Button>
              </div>
            </div>
          </div>
        )}
      </SidePanel>


    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-12 bg-white rounded-xl"></div>
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-xl"></div>
        ))}
      </div>
      <div className="h-64 bg-white rounded-xl"></div>
    </div>
  );
}
