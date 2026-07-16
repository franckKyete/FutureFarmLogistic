interface StatusPillProps {
  status: 'actif' | 'en_pause' | 'suspendu' | 'audit';
  className?: string;
}

const STATUS_CONFIG: Record<
  StatusPillProps['status'],
  { label: string; classes: string }
> = {
  actif: {
    label: 'Actif',
    classes: 'bg-primary-container text-on-primary-container',
  },
  en_pause: {
    label: 'En pause',
    classes: 'bg-secondary-container text-on-secondary-container',
  },
  suspendu: {
    label: 'Suspendu',
    classes: 'bg-red-100 text-red-700',
  },
  audit: {
    label: 'Audit',
    classes: 'bg-surface-container-high text-on-surface-variant',
  },
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.classes,
        className,
      ].join(' ')}
    >
      {cfg.label}
    </span>
  );
}
