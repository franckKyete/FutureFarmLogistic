type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'suspended'
  | 'banned'
  | 'approved'
  | 'rejected'
  | 'shipped'
  | 'delivered'
  | 'new'
  | 'processing'
  | 'resolved'
  | 'high'
  | 'normal';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

const statusConfigs: Record<
  StatusType,
  { bg: string; text: string; label: string; showDot?: boolean }
> = {
  active: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-400', label: 'Actif', showDot: true },
  inactive: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Inactif' },
  pending: { bg: 'bg-orange-100 dark:bg-orange-950/30', text: 'text-orange-800 dark:text-orange-400', label: 'En attente', showDot: true },
  suspended: { bg: 'bg-yellow-100 dark:bg-yellow-950/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Suspendu', showDot: true },
  banned: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-800 dark:text-red-400', label: 'Banni' },
  approved: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-400', label: 'Approuvé' },
  rejected: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-800 dark:text-red-400', label: 'Rejeté' },
  shipped: { bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-800 dark:text-blue-400', label: 'En transit' },
  delivered: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-400', label: 'Livré' },
  new: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-800 dark:text-red-400', label: 'Nouveau', showDot: true },
  processing: { bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-800 dark:text-blue-400', label: 'En cours', showDot: true },
  resolved: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-400', label: 'Résolu' },
  high: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-800 dark:text-red-400', label: 'Haute' },
  normal: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-400', label: 'Normale' },
};

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const normStatus = status.toLowerCase() as StatusType;
  const config = statusConfigs[normStatus] || {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-400',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${config.bg} ${config.text} ${className}`}
    >
      {config.showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.text.replace('text-', 'bg-')}`} />
      )}
      {label || config.label}
    </span>
  );
}
