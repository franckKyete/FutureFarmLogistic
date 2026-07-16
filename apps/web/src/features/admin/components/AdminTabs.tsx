interface TabItem {
  id: string;
  label: string;
  count?: number;
  countColorClass?: string | undefined;
}

interface AdminTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function AdminTabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: AdminTabsProps) {
  return (
    <div className={`flex items-center gap-8 border-b border-[var(--admin-outline-variant)]/40 mb-8 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`pb-4 px-2 text-sm font-semibold flex items-center gap-2 transition-all relative ${
              isActive
                ? 'text-[var(--admin-primary)] border-b-2 border-[var(--admin-primary)]'
                : 'text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  tab.countColorClass || (isActive 
                    ? 'bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]' 
                    : 'bg-[var(--admin-surface-container-high)] text-[var(--admin-on-surface-variant)]')
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
