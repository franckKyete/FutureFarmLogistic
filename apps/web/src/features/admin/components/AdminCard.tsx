import { ReactNode } from 'react';

interface AdminCardProps {
  children: ReactNode;
  className?: string;
}

export function AdminCard({ children, className = '' }: AdminCardProps) {
  return (
    <div
      className={`bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/40 rounded-xl p-6 transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
