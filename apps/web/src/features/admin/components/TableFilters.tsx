import { ReactNode } from 'react';

interface TableFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onReset?: () => void;
}

export function TableFilters({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  children,
  onReset,
}: TableFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center bg-[var(--admin-surface-container-lowest)] p-4 border border-[var(--admin-outline-variant)]/40 rounded-xl">
      <div className="flex-1 min-w-[200px] relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-on-surface-variant)] text-[20px]">
          search
        </span>
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-transparent border-[var(--admin-outline-variant)]/40 rounded-lg text-sm focus:ring-[var(--admin-primary)]/20 focus:border-[var(--admin-primary)] text-[var(--admin-on-surface)] placeholder-[var(--admin-on-surface-variant)]/60"
          placeholder={searchPlaceholder}
          type="text"
        />
      </div>
      {children}
      {onReset && (
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium border border-[var(--admin-outline-variant)]/40 rounded-lg text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container-low)] transition-all"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
