import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import { Button } from '@/components/ui/Button';
import {
  Permission,
  Dispute,
  DisputeStatus,
  DisputeSeverity,
} from '@futurefarm/types';
import {
  useDisputes,
  useCreateDispute,
  useResolveDispute,
} from '@/features/admin/api/disputes.queries';

export const Route = createFileRoute('/admin/disputes')({
  beforeLoad: () => {
    requireAuth(Permission.DISPUTE_READ);
  },
  component: DisputesPage,
});

const SEVERITY_CONFIG: Record<
  DisputeSeverity,
  { label: string; classes: string }
> = {
  [DisputeSeverity.LOW]: {
    label: 'Faible',
    classes: 'bg-gray-100 text-gray-700 ring-gray-300',
  },
  [DisputeSeverity.MEDIUM]: {
    label: 'Moyenne',
    classes: 'bg-blue-100 text-blue-700 ring-blue-300',
  },
  [DisputeSeverity.HIGH]: {
    label: 'Haute',
    classes: 'bg-amber-100 text-amber-700 ring-amber-300',
  },
  [DisputeSeverity.CRITICAL]: {
    label: 'Critique',
    classes: 'bg-red-100 text-red-700 ring-red-300',
  },
};

const STATUS_CONFIG: Record<
  DisputeStatus,
  { label: string; classes: string }
> = {
  [DisputeStatus.OPEN]: {
    label: 'Ouvert',
    classes: 'bg-red-100 text-red-700 ring-red-300',
  },
  [DisputeStatus.UNDER_REVIEW]: {
    label: 'En examen',
    classes: 'bg-amber-100 text-amber-700 ring-amber-300',
  },
  [DisputeStatus.RESOLVED]: {
    label: 'Résolu',
    classes: 'bg-green-100 text-green-700 ring-green-300',
  },
  [DisputeStatus.DISMISSED]: {
    label: 'Rejeté',
    classes: 'bg-gray-100 text-gray-500 ring-gray-200',
  },
};

const RELATED_TYPE_LABELS: Record<string, string> = {
  order: 'Commande',
  inspection: 'Inspection',
  delivery: 'Livraison',
};

const SEVERITY_OPTIONS: { value: DisputeSeverity; label: string }[] = [
  { value: DisputeSeverity.LOW, label: 'Faible' },
  { value: DisputeSeverity.MEDIUM, label: 'Moyenne' },
  { value: DisputeSeverity.HIGH, label: 'Haute' },
  { value: DisputeSeverity.CRITICAL, label: 'Critique' },
];

const RELATED_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'order', label: 'Commande' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'delivery', label: 'Livraison' },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function SeverityBadge({ severity }: { severity: DisputeSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: DisputeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-xl border border-gray-200 animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function CreateDisputeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateDispute();
  const { can } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DisputeSeverity>(DisputeSeverity.MEDIUM);
  const [relatedType, setRelatedType] = useState<string>('order');
  const [relatedId, setRelatedId] = useState('');

  const canCreate = can(Permission.DISPUTE_CREATE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    try {
      await createMutation.mutateAsync({
        title,
        description,
        severity,
        relatedType: relatedType as 'order' | 'inspection' | 'delivery',
        relatedId,
      });
      addToast('Litige créé avec succès.', 'success');
      setTitle('');
      setDescription('');
      setSeverity(DisputeSeverity.MEDIUM);
      setRelatedType('order');
      setRelatedId('');
      onClose();
    } catch {
      addToast('Erreur lors de la création du litige.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau litige">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titre
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors"
            placeholder="Objet du litige"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors resize-none"
            placeholder="Décrivez le litige..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sévérité
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as DisputeSeverity)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type d'entité liée
          </label>
          <select
            value={relatedType}
            onChange={(e) => setRelatedType(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors"
          >
            {RELATED_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID de l'entité liée
          </label>
          <input
            type="text"
            required
            value={relatedId}
            onChange={(e) => setRelatedId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors"
            placeholder="ID de la commande, inspection ou livraison"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createMutation.isPending}
            disabled={!canCreate}>
            Créer le litige
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResolveDisputeModal({
  open,
  onClose,
  dispute,
}: {
  open: boolean;
  onClose: () => void;
  dispute: Dispute | null;
}) {
  const resolveMutation = useResolveDispute();

  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveStatus, setResolveStatus] = useState<
    DisputeStatus.RESOLVED | DisputeStatus.DISMISSED
  >(DisputeStatus.RESOLVED);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispute) return;

    try {
      await resolveMutation.mutateAsync({
        id: dispute.id,
        resolutionNotes,
        status: resolveStatus,
      });
      addToast('Litige résolu avec succès.', 'success');
      setResolutionNotes('');
      setResolveStatus(DisputeStatus.RESOLVED);
      onClose();
    } catch {
      addToast("Erreur lors de la résolution du litige.", 'error');
    }
  };

  if (!dispute) return null;

  return (
    <Modal open={open} onClose={onClose} title="Résoudre le litige">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Résolution du litige :{' '}
          <span className="font-medium text-gray-900">{dispute.title}</span>
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes de résolution
          </label>
          <textarea
            required
            rows={4}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors resize-none"
            placeholder="Expliquez la résolution..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statut de résolution
          </label>
          <select
            value={resolveStatus}
            onChange={(e) =>
              setResolveStatus(
                e.target.value as DisputeStatus.RESOLVED | DisputeStatus.DISMISSED,
              )
            }
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-colors"
          >
            <option value={DisputeStatus.RESOLVED}>Résolu</option>
            <option value={DisputeStatus.DISMISSED}>Rejeté</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={resolveMutation.isPending}
          >
            Confirmer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DisputesPage() {
  const { data: disputes, isLoading, isError } = useDisputes();
  const { can } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Dispute | null>(null);

  const canCreate = can(Permission.DISPUTE_CREATE);
  const canResolve = can(Permission.DISPUTE_RESOLVE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-gray-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
          <span className="text-sm">Chargement des litiges...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
          <div>
            <h3 className="text-sm font-semibold text-red-800">
              Erreur de chargement
            </h3>
            <p className="text-sm text-red-600 mt-1">
              Impossible de charger la liste des litiges. Veuillez réessayer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const disputeList = Array.isArray(disputes) ? disputes : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion des litiges
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivez et résolvez les litiges liés aux commandes, inspections et
            livraisons.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <span className="material-symbols-outlined text-lg">add</span>
            Nouveau litige
          </Button>
        )}
      </div>

      {disputeList.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3">
            scale
          </span>
          <p className="text-sm text-gray-400">Aucun litige trouvé.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Titre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sévérité
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Entité liée
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date création
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {disputeList.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {d.title}
                    </div>
                    {d.description && (
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                        {d.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={d.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <span className="material-symbols-outlined text-base">
                        {d.relatedType === 'order'
                          ? 'shopping_bag'
                          : d.relatedType === 'inspection'
                            ? 'verified'
                            : 'local_shipping'}
                      </span>
                      {RELATED_TYPE_LABELS[d.relatedType] ?? d.relatedType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(d.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {d.status === DisputeStatus.OPEN && canResolve && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setResolveTarget(d)}
                      >
                        <span className="material-symbols-outlined text-base">
                          check_circle
                        </span>
                        Résoudre
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDisputeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ResolveDisputeModal
        open={resolveTarget !== null}
        onClose={() => {
          setResolveTarget(null);
        }}
        dispute={resolveTarget}
      />
    </div>
  );
}
