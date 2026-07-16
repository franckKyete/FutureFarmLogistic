import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth } from '@/features/auth/store/auth.store';
import { useLocation, Link } from '@tanstack/react-router';
import { Permission } from '@futurefarm/types';

type NavLink = {
  label: string;
  path: string;
  icon: string;
  permission: Permission;
};

const NAV_LINKS: NavLink[] = [
  { label: 'Tableau de bord', path: '/admin/dashboard', icon: 'dashboard', permission: Permission.DASHBOARD_READ },
  { label: 'Expéditions', path: '/admin/logistics', icon: 'local_shipping', permission: Permission.DELIVERY_RUN_READ_ALL },
  { label: 'Utilisateurs & Rôles', path: '/admin/users', icon: 'group', permission: Permission.USER_READ },
  { label: 'Inspections & Qualité', path: '/admin/inspections', icon: 'verified', permission: Permission.INSPECTION_READ_ALL },
  { label: 'Validation récoltes', path: '/admin/harvests', icon: 'rule', permission: Permission.HARVEST_VERIFY },
  { label: 'Supervision des enchères', path: '/admin/auctions', icon: 'gavel', permission: Permission.AUCTION_MANAGE },
  { label: 'Gestion des litiges', path: '/admin/disputes', icon: 'scale', permission: Permission.DISPUTE_READ },
  { label: 'Transactions', path: '/admin/transactions', icon: 'receipt_long', permission: Permission.ORDER_READ_ALL },
  { label: 'Analytiques & rapports', path: '/admin/analytics', icon: 'bar_chart', permission: Permission.DASHBOARD_READ },
];

function NavLinkItem({ link }: { link: NavLink }) {
  const location = useLocation();
  const { can } = useAuth();
  const isActive = location.pathname === link.path;

  if (!can(link.permission)) {
    return null;
  }

  return (
    <Link
      to={link.path}
      className={`flex items-center gap-3 px-4 py-3 font-medium transition-all ${
        isActive
          ? 'text-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10 border-r-4 border-[var(--admin-primary)]'
          : 'text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container-high)] hover:text-[var(--admin-primary)]'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
      <span className="text-sm">{link.label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  const { user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 w-[240px] h-screen bg-[var(--admin-surface-container-lowest)] border-r border-[var(--admin-outline-variant)] flex flex-col justify-between">
      <div>
        <div className="p-6 flex flex-col gap-0.5 border-b border-[var(--admin-outline-variant)]/40">
          <span className="text-lg font-bold text-[var(--admin-primary)] tracking-tight">Future Farm</span>
          <span className="text-[10px] font-bold text-[var(--admin-on-surface-variant)]/70 uppercase tracking-widest">
            Logistic V2.0
          </span>
        </div>
        <nav className="mt-4 flex flex-col">
          {NAV_LINKS.map((link) => (
            <NavLinkItem key={link.path} link={link} />
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-[var(--admin-outline-variant)]/40 space-y-4">
        {user && (
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-[var(--admin-primary-container)]/20 flex items-center justify-center border border-[var(--admin-primary)]/10 overflow-hidden shrink-0">
              <span className="material-symbols-outlined text-[20px] text-[var(--admin-primary)]">person</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate text-[var(--admin-on-surface)]">
                {`${user.firstName} ${user.lastName}`}
              </p>
              <p className="text-[10px] text-[var(--admin-on-surface-variant)] font-medium uppercase truncate">
                {user.roles?.[0] || 'Admin Principal'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => clearAuth()}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container-high)] hover:text-[var(--admin-error)] transition-colors rounded-xl text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

