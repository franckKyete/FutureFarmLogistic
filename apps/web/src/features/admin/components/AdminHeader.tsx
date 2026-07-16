import { useAuth } from '@/features/auth/hooks/useAuth';
import { useState } from 'react';

export function AdminHeader() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'main' | 'management' | 'finance' | 'system'>('management');

  return (
    <header className="fixed top-0 right-0 h-[60px] left-[240px] bg-[var(--admin-surface-container-lowest)] border-b border-[var(--admin-outline-variant)]/40 flex justify-between items-center px-6 z-40">
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-[400px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-on-surface-variant)] text-lg">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-[var(--admin-surface-container-low)] border-none rounded-full text-sm focus:ring-2 focus:ring-[var(--admin-primary)]/20 text-[var(--admin-on-surface)] placeholder-[var(--admin-on-surface-variant)]/60"
            placeholder="Rechercher un utilisateur, un ID ou un document..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-6 mr-6">
          {(['main', 'management', 'finance', 'system'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`capitalize transition-colors text-sm font-medium ${
                activeTab === tab
                  ? 'text-[var(--admin-primary)] font-bold border-b-2 border-[var(--admin-primary)] pb-1 pt-1'
                  : 'text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]'
              }`}
            >
              {tab === 'main' ? 'Main' : tab === 'management' ? 'Management' : tab === 'finance' ? 'Finance' : 'System'}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[var(--admin-surface-container-high)] rounded-full relative text-[var(--admin-on-surface-variant)]">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--admin-secondary)] rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-[var(--admin-surface-container-high)] rounded-full text-[var(--admin-on-surface-variant)]">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>

          <div className="h-8 w-[1px] bg-[var(--admin-outline-variant)]/40 mx-2"></div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                {user ? `${user.firstName} ${user.lastName}` : 'Jean Dupont'}
              </p>
              <p className="text-[10px] text-[var(--admin-on-surface-variant)] font-medium uppercase">
                {user?.roles?.[0] || 'Admin Principal'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--admin-primary-container)]/10 flex items-center justify-center border border-[var(--admin-primary)]/10 overflow-hidden">
              <span className="material-symbols-outlined text-xl text-[var(--admin-primary)]">person</span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
