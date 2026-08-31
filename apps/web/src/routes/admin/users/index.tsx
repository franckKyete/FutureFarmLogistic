import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, UserStatus } from '@futurefarm/types';
import {
  useUsers,
  useUser,
  useUpdateUserStatus,
  useResendWelcomeNotification,
  useUpdateUser,
} from '@/features/admin/api/users.queries';
import type {
  AdminUserDto,
  DriverProfileInfo,
  InspectorProfileInfo,
  FarmerProfileInfo,
  BuyerProfileInfo,
} from '@/features/admin/types';
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
  const updateUserMutation = useUpdateUser();
  const resendWelcomeMutation = useResendWelcomeNotification();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: userDetail } = useUser(selectedUserId || '');

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);
  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Inline editing state for admin user details
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [customSpecInput, setCustomSpecInput] = useState('');
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    licenseNumber: '',
    licenseCategory: 'B',
    isAvailable: true,
    agencyName: '',
    specializations: [] as string[],
    companyName: '',
    bio: '',
    vatNumber: '',
    shippingAddress: '',
    isCertified: false,
  });

  const AVAILABLE_SPECIALIZATIONS = [
    'Cacao & Café',
    'Tubercules (Manioc, Igname)',
    'Oléagineux & Noix',
    'Céréales (Maïs, Riz)',
    'Fruits & Légumes',
    'Élevage & Aviculture',
    'Cultures maraîchères',
  ];

  const startEditing = (u: AdminUserDto) => {
    const prof = (u.profile as any) || {};
    setEditFormData({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phoneNumber: u.phone || '',
      address: prof.address || prof.shippingAddress || prof.billingAddress || '',
      licenseNumber: prof.licenseNumber || '',
      licenseCategory: prof.licenseCategory || 'B',
      isAvailable: prof.isAvailable !== false,
      agencyName: prof.agencyName || '',
      specializations: Array.isArray(prof.specializations) ? [...prof.specializations] : [],
      companyName: prof.companyName || '',
      bio: prof.bio || '',
      vatNumber: prof.vatNumber || '',
      shippingAddress: prof.shippingAddress || '',
      isCertified: !!prof.isCertified,
    });
    setCustomSpecInput('');
    setIsEditingUser(true);
  };

  const handleToggleSpecialization = (spec: string) => {
    setEditFormData((prev) => {
      const exists = prev.specializations.includes(spec);
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter((s) => s !== spec)
          : [...prev.specializations, spec],
      };
    });
  };

  const handleAddCustomSpecialization = () => {
    const trimmed = customSpecInput.trim();
    if (!trimmed) return;
    if (!editFormData.specializations.includes(trimmed)) {
      setEditFormData((prev) => ({
        ...prev,
        specializations: [...prev.specializations, trimmed],
      }));
    }
    setCustomSpecInput('');
  };

  const handleSaveUserEdit = (userId: string) => {
    updateUserMutation.mutate(
      {
        id: userId,
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        email: editFormData.email,
        phoneNumber: editFormData.phoneNumber,
        address: editFormData.address || undefined,
        licenseNumber: editFormData.licenseNumber || undefined,
        licenseCategory: editFormData.licenseCategory || undefined,
        isAvailable: editFormData.isAvailable,
        agencyName: editFormData.agencyName || undefined,
        specializations: editFormData.specializations,
        companyName: editFormData.companyName || undefined,
        bio: editFormData.bio || undefined,
        vatNumber: editFormData.vatNumber || undefined,
        shippingAddress: editFormData.shippingAddress || undefined,
        isCertified: editFormData.isCertified,
      },
      {
        onSuccess: () => {
          addToast('Informations utilisateur mises à jour avec succès.', 'success');
          setIsEditingUser(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Erreur lors de la mise à jour';
          addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        },
      },
    );
  };

  const handleResendWelcome = (user: AdminUserDto) => {
    resendWelcomeMutation.mutate(user.id, {
      onSuccess: () => {
        addToast(`Email d'activation renvoyé avec succès à ${user.email}`, 'success');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || "Échec du renvoi de l'email d'activation";
        addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
      },
    });
  };

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isVerifyPanelOpen, setIsVerifyPanelOpen] = useState(false);
  const [verifyingUser, setVerifyingUser] = useState<AdminUserDto | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    user: AdminUserDto;
    newStatus: UserStatus;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: 'danger' | 'primary';
  } | null>(null);

  const executeConfirmedStatusChange = () => {
    if (!confirmAction) return;
    handleStatusChange(confirmAction.user.id, confirmAction.newStatus);
    setConfirmAction(null);
  };

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
          addToast(
            newStatus === UserStatus.APPROVED
              ? 'Compte utilisateur réactivé avec succès.'
              : 'Compte utilisateur suspendu avec succès.',
            'success',
          );
        },
      },
    );
  };

  const userList = Array.isArray(users) ? users : [];
  const selectedUser = userDetail || userList.find((u) => u.id === selectedUserId) || null;

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
      render: (u: AdminUserDto) => {
        const address =
          (u.profile as any)?.address ||
          (u.profile as any)?.shippingAddress ||
          (u.profile as any)?.billingAddress;
        return (
          <div>
            <p className="text-xs text-[var(--admin-on-surface)] font-medium">
              {address || 'Non renseignée'}
            </p>
          </div>
        );
      },
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
        if (!u.isActive) {
          return <StatusBadge status="pending" label="Inactif" />;
        }
        const statusMap: Record<UserStatus, string> = {
          [UserStatus.APPROVED]: 'active',
          [UserStatus.SUSPENDED]: 'suspended',
          [UserStatus.PENDING_VALIDATION]: 'pending',
          [UserStatus.BANNED]: 'suspended',
        };
        return <StatusBadge status={statusMap[u.status] || 'active'} />;
      },
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
              setSelectedUserId(u.id);
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
        onClose={() => {
          setIsDetailPanelOpen(false);
          setSelectedUserId(null);
        }}
        title="Détails du compte utilisateur"
        width="w-[560px]"
      >
        {selectedUser && (
          <div className="p-6 space-y-6">
            {/* Header / Edit toggle */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--admin-outline-variant)]/20">
              <span className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                {isEditingUser ? 'Édition du profil' : 'Fiche collaborateur'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isEditingUser) {
                    setIsEditingUser(false);
                  } else {
                    startEditing(selectedUser);
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-[var(--admin-outline-variant)] hover:bg-[var(--admin-surface-container-low)] text-xs font-bold text-[var(--admin-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {isEditingUser ? 'close' : 'edit'}
                </span>
                {isEditingUser ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {/* User Header Profile */}
            <div className="bg-[var(--admin-surface-container-low)]/40 border border-[var(--admin-outline-variant)]/30 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
              <div className="w-20 h-20 rounded-full bg-[var(--admin-primary-container)]/15 border-2 border-[var(--admin-primary)]/20 shadow-sm overflow-hidden flex items-center justify-center mb-3 font-bold text-xl text-[var(--admin-primary)]">
                {getInitials(selectedUser)}
              </div>
              <h3 className="text-xl font-bold text-[var(--admin-on-surface)] mb-1">
                {selectedUser.firstName} {selectedUser.lastName}
              </h3>
              <p className="text-xs text-[var(--admin-on-surface-variant)] font-mono mb-3">
                ID: #{selectedUser.id}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 bg-[var(--admin-primary)]/10 text-[var(--admin-primary)] rounded-full text-[11px] font-bold uppercase tracking-wider">
                  {selectedUser.roles?.map((r: { id: string; name: string }) => getFrenchRole(r.name)).join(', ') || 'Utilisateur'}
                </span>
                {!selectedUser.isActive ? (
                  <StatusBadge status="pending" label="Inactif" />
                ) : (
                  <StatusBadge
                    status={
                      selectedUser.status === UserStatus.APPROVED
                        ? 'active'
                        : selectedUser.status === UserStatus.SUSPENDED
                        ? 'suspended'
                        : 'pending'
                    }
                  />
                )}
              </div>
            </div>

            {isEditingUser ? (
              /* Inline Edit Form */
              <div className="space-y-5">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">edit_note</span>
                    Informations générales
                  </h4>
                  <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={editFormData.phoneNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                        placeholder="+221..."
                        className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                        Adresse / Localisation
                      </label>
                      <input
                        type="text"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        placeholder="Ex: Dakar, Sénégal"
                        className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Role Specific Fields in Edit Mode */}
                {(() => {
                  const roleName = selectedUser.roles[0]?.name || '';
                  if (roleName === 'Driver') {
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">local_shipping</span>
                          Données Chauffeur
                        </h4>
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                                Numéro de Permis
                              </label>
                              <input
                                type="text"
                                value={editFormData.licenseNumber}
                                onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                                Catégorie Permis
                              </label>
                              <select
                                value={editFormData.licenseCategory}
                                onChange={(e) => setEditFormData({ ...editFormData, licenseCategory: e.target.value })}
                                className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                              >
                                <option value="B">Permis B (Véhicule léger)</option>
                                <option value="C">Permis C (Poids lourd)</option>
                                <option value="C1">Permis C1</option>
                                <option value="CE">Permis CE (Semi-remorque)</option>
                              </select>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editFormData.isAvailable}
                              onChange={(e) => setEditFormData({ ...editFormData, isAvailable: e.target.checked })}
                              className="rounded border-[var(--admin-outline-variant)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            />
                            <span className="text-xs font-semibold text-[var(--admin-on-surface)]">
                              Disponible pour de nouvelles missions de livraison
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  }
                  if (roleName === 'Inspector') {
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">verified_user</span>
                          Données Inspecteur
                        </h4>
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Agence / Entreprise
                            </label>
                            <input
                              type="text"
                              value={editFormData.agencyName}
                              onChange={(e) => setEditFormData({ ...editFormData, agencyName: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Numéro d'agrément
                            </label>
                            <input
                              type="text"
                              value={editFormData.licenseNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1.5">
                              Spécialisations agricoles
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {AVAILABLE_SPECIALIZATIONS.map((spec) => {
                                const isSelected = editFormData.specializations.includes(spec);
                                return (
                                  <button
                                    key={spec}
                                    type="button"
                                    onClick={() => handleToggleSpecialization(spec)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                      isSelected
                                        ? 'bg-[var(--admin-primary)] text-white shadow-xs'
                                        : 'bg-[var(--admin-surface-container-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-outline-variant)]/40'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">
                                      {isSelected ? 'check' : 'add'}
                                    </span>
                                    {spec}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customSpecInput}
                                onChange={(e) => setCustomSpecInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomSpecialization();
                                  }
                                }}
                                placeholder="Ajouter une autre spécialité..."
                                className="flex-1 px-3 py-1.5 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleAddCustomSpecialization}
                                className="py-1.5 px-3 text-xs"
                              >
                                Ajouter
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (roleName === 'Farmer') {
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">agriculture</span>
                          Données Exploitation Agricole
                        </h4>
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Nom de l'exploitation
                            </label>
                            <input
                              type="text"
                              value={editFormData.companyName}
                              onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Adresse de la ferme
                            </label>
                            <input
                              type="text"
                              value={editFormData.address}
                              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Présentation
                            </label>
                            <textarea
                              rows={2}
                              value={editFormData.bio}
                              onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                          <label className="flex items-center gap-2 pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editFormData.isCertified}
                              onChange={(e) => setEditFormData({ ...editFormData, isCertified: e.target.checked })}
                              className="rounded border-[var(--admin-outline-variant)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            />
                            <span className="text-xs font-semibold text-[var(--admin-on-surface)]">
                              Exploitation certifiée Bio
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  }
                  if (roleName === 'Buyer') {
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">storefront</span>
                          Données Entreprise & Facturation
                        </h4>
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Nom de l'entreprise
                            </label>
                            <input
                              type="text"
                              value={editFormData.companyName}
                              onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              N° TVA / Registre
                            </label>
                            <input
                              type="text"
                              value={editFormData.vatNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, vatNumber: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[var(--admin-on-surface-variant)] mb-1">
                              Adresse de livraison
                            </label>
                            <input
                              type="text"
                              value={editFormData.shippingAddress}
                              onChange={(e) => setEditFormData({ ...editFormData, shippingAddress: e.target.value })}
                              className="w-full px-3 py-2 border border-[var(--admin-outline-variant)] rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Save and Cancel buttons */}
                <div className="flex items-center gap-3 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsEditingUser(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleSaveUserEdit(selectedUser.id)}
                    disabled={updateUserMutation.isPending}
                    className="flex-1 py-2.5 bg-[var(--admin-primary)] text-white hover:brightness-110 rounded-xl text-xs font-bold"
                  >
                    {updateUserMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Read-only details view */
              <>
                {/* General Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">contact_mail</span>
                    Coordonnées & Informations générales
                  </h4>
                  <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Email</p>
                      <p className="font-medium text-[var(--admin-on-surface)] truncate mt-0.5" title={selectedUser.email}>
                        {selectedUser.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Téléphone</p>
                      <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                        {selectedUser.phone || 'Non renseigné'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Date d'inscription</p>
                      <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                        {formatDate(selectedUser.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Localisation</p>
                      <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                        {(selectedUser.profile as any)?.address ||
                          (selectedUser.profile as any)?.shippingAddress ||
                          (selectedUser.profile as any)?.billingAddress ||
                          'Non renseignée'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role-Specific Profile Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[var(--admin-primary)]">badge</span>
                    Données professionnelles ({getFrenchRole(selectedUser.roles[0]?.name || 'Utilisateur')})
                  </h4>

                  {(() => {
                    const roleName = selectedUser.roles[0]?.name || '';
                    const profile = selectedUser.profile as any;

                    if (roleName === 'Driver') {
                      const driverProfile = profile as DriverProfileInfo | undefined;
                      return (
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--admin-primary)]">
                              <span className="material-symbols-outlined text-base">local_shipping</span>
                              Permis & Flotte de transport
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              driverProfile?.isAvailable !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {driverProfile?.isAvailable !== false ? 'Disponible' : 'Indisponible'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Numéro de Permis</p>
                              <p className="font-mono font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {driverProfile?.licenseNumber || 'Non renseigné'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Catégorie</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {driverProfile?.licenseCategory ? `Permis ${driverProfile.licenseCategory}` : 'Non renseignée'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Expiration Permis</p>
                              <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                                {driverProfile?.licenseExpiresAt ? formatDate(driverProfile.licenseExpiresAt) : 'Non renseignée'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Livraisons effectuées</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {driverProfile?.totalDeliveriesCompleted ?? 0} courses
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (roleName === 'Inspector') {
                      const inspectorProfile = profile as InspectorProfileInfo | undefined;
                      return (
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--admin-primary)]">
                              <span className="material-symbols-outlined text-base">verified_user</span>
                              Agrément & Spécialités d'Inspection
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              {inspectorProfile?.isActiveInspector !== false ? 'Inspecteur Actif' : 'Inactif'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Agence / Entreprise</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {inspectorProfile?.agencyName || 'Non renseignée'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Numéro d'agrément</p>
                              <p className="font-mono font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {inspectorProfile?.licenseNumber || 'Non renseigné'}
                              </p>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl text-xs">
                            <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold mb-1.5">Spécialisations agricoles</p>
                            {inspectorProfile?.specializations && inspectorProfile.specializations.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {inspectorProfile.specializations.map((spec: string) => (
                                  <span key={spec} className="px-2 py-0.5 rounded-md bg-[var(--admin-primary)]/10 text-[var(--admin-primary)] text-[11px] font-semibold">
                                    {spec}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 italic text-[11px]">Aucune spécialisation enregistrée</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (roleName === 'Farmer') {
                      const farmerProfile = profile as FarmerProfileInfo | undefined;
                      return (
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--admin-primary)]">
                              <span className="material-symbols-outlined text-base">agriculture</span>
                              Exploitation Agricole
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              farmerProfile?.isCertified
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {farmerProfile?.isCertified ? 'Certifié Bio' : 'Non certifié'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Nom de l'exploitation</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {farmerProfile?.companyName || 'Non renseigné'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Parcelles déclarées</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {farmerProfile?.parcels?.length ?? 0} parcelles
                              </p>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl text-xs">
                            <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Adresse de la ferme</p>
                            <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                              {farmerProfile?.address || 'Non renseignée'}
                            </p>
                          </div>

                          <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl text-xs">
                            <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Présentation</p>
                            <p className="text-gray-600 mt-0.5 italic">
                              {farmerProfile?.bio || 'Non renseignée'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (roleName === 'Buyer') {
                      const buyerProfile = profile as BuyerProfileInfo | undefined;
                      return (
                        <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--admin-primary)]">
                              <span className="material-symbols-outlined text-base">storefront</span>
                              Entreprise & Facturation
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase">
                              {buyerProfile?.businessType || 'Acheteur'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Société</p>
                              <p className="font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {buyerProfile?.companyName || 'Non renseigné'}
                              </p>
                            </div>
                            <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl">
                              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">N° TVA / Registre</p>
                              <p className="font-mono font-bold text-[var(--admin-on-surface)] mt-0.5">
                                {buyerProfile?.vatNumber || 'Non renseigné'}
                              </p>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[var(--admin-surface-container-low)]/40 rounded-xl text-xs">
                            <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase font-semibold">Adresse de livraison</p>
                            <p className="font-medium text-[var(--admin-on-surface)] mt-0.5">
                              {buyerProfile?.shippingAddress || 'Non renseignée'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-white border border-[var(--admin-outline-variant)]/30 rounded-2xl p-4 text-xs">
                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--admin-primary)] mb-1">
                          <span className="material-symbols-outlined text-base">shield_person</span>
                          Privilèges Administrateur
                        </div>
                        <p className="text-gray-600">Accès complet à la supervision du réseau Future Farm, gestion des utilisateurs et validation.</p>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {/* Actions Bar */}
            <div className="pt-4 border-t border-[var(--admin-outline-variant)]/30">
              <h4 className="text-[11px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider mb-3">
                Actions de gestion du compte
              </h4>

              {!selectedUser.isActive ? (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--admin-on-surface-variant)] leading-relaxed">
                    Ce compte est actuellement inactif. Il s'activera automatiquement dès la première connexion du collaborateur.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleResendWelcome(selectedUser)}
                    disabled={resendWelcomeMutation.isPending}
                    title="Renvoyer l'email d'activation avec de nouveaux identifiants"
                    className="w-full py-2.5 px-4 bg-[var(--admin-primary)]/10 hover:bg-[var(--admin-primary)]/20 text-[var(--admin-primary)] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                    Renvoyer les accès
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {selectedUser.status === UserStatus.APPROVED ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          user: selectedUser,
                          newStatus: UserStatus.SUSPENDED,
                          title: 'Suspendre le compte',
                          message: `Êtes-vous sûr de vouloir suspendre le compte de ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email}) ? L'utilisateur ne pourra plus accéder à la plateforme.`,
                          confirmLabel: 'Suspendre le compte',
                          confirmVariant: 'danger',
                        })
                      }
                      disabled={updateStatus.isPending}
                      className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">pause_circle</span>
                      Suspendre le compte
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          user: selectedUser,
                          newStatus: UserStatus.APPROVED,
                          title: 'Réactiver le compte',
                          message: `Êtes-vous sûr de vouloir réactiver le compte de ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email}) ?`,
                          confirmLabel: 'Réactiver le compte',
                          confirmVariant: 'primary',
                        })
                      }
                      disabled={updateStatus.isPending}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Réactiver le compte
                    </button>
                  )}
                </div>
              )}
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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-slide-in">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
                confirmAction.confirmVariant === 'danger'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {confirmAction.confirmVariant === 'danger' ? 'warning' : 'check_circle'}
              </span>
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-bold text-lg text-gray-900">{confirmAction.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{confirmAction.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmAction(null)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold"
              >
                Annuler
              </Button>
              <button
                type="button"
                onClick={executeConfirmedStatusChange}
                disabled={updateStatus.isPending}
                className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 ${
                  confirmAction.confirmVariant === 'danger'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white'
                : 'bg-red-800 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
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
