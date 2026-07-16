import type { ReactNode } from 'react';

type Trend = 'up' | 'down' | 'neutral';

interface StatCardProps {
  icon: string | ReactNode;
  value: string | number;
  label: string;
  trend?: Trend;
  trendLabel?: string;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

const trendIcons: Record<Trend, string> = {
  up: 'trending_up',
  down: 'trending_down',
  neutral: 'trending_flat',
};

const trendColors: Record<Trend, string> = {
  up: 'text-green-600',
  down: 'text-red-500',
  neutral: 'text-orange-500',
};

export function StatCard({
  icon,
  value,
  label,
  trend,
  trendLabel,
  iconBgColor = 'bg-[var(--admin-primary)]/10',
  iconColor = 'text-[var(--admin-primary)]',
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/40 rounded-xl p-6 flex flex-col gap-2 transition-all duration-200 ${className}`}
    >
      <div className="flex justify-between items-start">
        <div className={`p-2 ${iconBgColor} rounded-lg ${iconColor} flex items-center justify-center`}>
          {typeof icon === 'string' ? (
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          ) : (
            icon
          )}
        </div>
        {trend && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trendColors[trend]}`}>
            {trendLabel}
            <span className="material-symbols-outlined text-sm">{trendIcons[trend]}</span>
          </span>
        )}
      </div>
      <p className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)] uppercase tracking-wider mt-1">
        {label}
      </p>
      <h3 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight">
        {value}
      </h3>
    </div>
  );
}

