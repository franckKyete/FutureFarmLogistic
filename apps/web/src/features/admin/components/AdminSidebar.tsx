import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLocation, Link } from '@tanstack/react-router';
import { Permission } from '@futurefarm/types';

type NavSection = {
  title: string;
  links: NavLink[];
};

type NavLink = {
  label: string;
  path: string;
  icon: string;
  permission: Permission;
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Vue d'ensemble",
    links: [
      { label: 'Tableau de bord', path: '/admin/dashboard', icon: 'dashboard', permission: Permission.DASHBOARD_READ },
    ],
  },
  {
    title: 'Gestion',
    links: [
      { label: 'Utilisateurs', path: '/admin/users', icon: 'people', permission: Permission.USER_READ },
      { label: 'Rôles', path: '/admin/roles', icon: 'security', permission: Permission.ROLE_READ },
    ],
  },
  {
    title: 'Opérations',
    links: [
      { label: 'Inspections & Qualité', path: '/admin/inspections', icon: 'verified', permission: Permission.INSPECTION_READ_ALL },
      { label: 'Gestion Logistique', path: '/admin/logistics', icon: 'local_shipping', permission: Permission.DELIVERY_RUN_READ_ALL },
      { label: 'Supervision des enchères', path: '/admin/auctions', icon: 'gavel', permission: Permission.AUCTION_MANAGE },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Gestion des litiges', path: '/admin/disputes', icon: 'scale', permission: Permission.DISPUTE_READ },
      { label: 'Analytiques & rapports', path: '/admin/analytics', icon: 'bar_chart', permission: Permission.DASHBOARD_READ },
    ],
  },
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
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className="material-symbols-outlined text-2xl">{link.icon}</span>
      <span>{link.label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 w-64 h-screen bg-white border-r border-gray-200 overflow-y-auto sticky top-0">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <Link to="/admin/dashboard" className="text-lg font-bold text-[#1a5c35]">
          Administration
        </Link>
      </div>
      <nav className="p-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.links.map((link) => (
                <NavLinkItem key={link.path} link={link} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
