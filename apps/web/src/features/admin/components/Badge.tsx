import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary-container text-on-primary-container',
  warning: 'bg-secondary-container text-on-secondary-container',
  error: 'bg-red-100 text-red-700',
  info: 'bg-surface-container-high text-on-surface-variant',
};

export function Badge({
  variant = 'info',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
