import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, InspectionStatus } from '@futurefarm/types';
import type { InspectionReportDto, InspectorProfileDto } from '@futurefarm/types';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const Route = createFileRoute('/admin/inspections')({
  beforeLoad: () => {
    requireAuth(Permission.INSPECTION_READ_ALL);
  },
  component: InspectionsPage,
});

interface InspectionReportWithProfile extends InspectionReportDto {
  inspectorProfile?: InspectorProfileDto;
}

const STATUS_LABELS: Record<InspectionStatus, string> = {
  [InspectionStatus.IN_PROGRESS]: 'En cours',
  [InspectionStatus.SUBMITTED]: 'Soumis',
  [InspectionStatus.REJECTED]: 'Rejeté',
};

const STATUS_STYLES: Record<InspectionStatus, string> = {
  [InspectionStatus.IN_PROGRESS]: 'bg-blue-50 text-blue-700 ring-blue-200',
  [InspectionStatus.SUBMITTED]: 'bg-green-50 text-green-700 ring-green-200',
  [InspectionStatus.REJECTED]: 'bg-red-50 text-red-700 ring-red-200',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return dateFormatter.format(new Date(dateStr));
  } catch {
    return '—';
  }
}

function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${score}/10`;
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function InspectionsPage() {
  const { data, isLoading, isError } = useQuery<InspectionReportWithProfile[]>({
    queryKey: ['inspections', 'all'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: InspectionReportWithProfile[] }>(
        '/inspections/reports',
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspections & Qualité</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tous les rapports d'inspection qualité
          </p>
        </div>
        <div className="text-gray-400 p-6">Chargement…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspections & Qualité</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tous les rapports d'inspection qualité
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
          Erreur lors du chargement des rapports d'inspection.
        </div>
      </div>
    );
  }

  const reports = Array.isArray(data) ? data : [];

  if (reports.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspections & Qualité</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tous les rapports d'inspection qualité
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            verified
          </span>
          <p className="text-gray-400 text-sm">Aucun rapport d'inspection trouvé.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inspections & Qualité</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tous les rapports d'inspection qualité
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                ID
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Statut
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Score qualité
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Date visite
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Inspecteur
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((report) => {
              const score = report.finalQualityScore;
              const scoreColor =
                score != null
                  ? score >= 5
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-gray-400';

              return (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <code className="text-xs text-gray-500 font-mono">
                      {truncateId(report.id)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        STATUS_STYLES[report.status] ?? 'bg-gray-50 text-gray-700 ring-gray-200'
                      }`}
                    >
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${scoreColor}`}>
                      {formatScore(score)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-gray-400">
                        calendar_month
                      </span>
                      {formatDate(report.siteVisitDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="material-symbols-outlined text-base text-gray-400">
                        person
                      </span>
                      {report.inspectorProfile?.agencyName ?? '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
