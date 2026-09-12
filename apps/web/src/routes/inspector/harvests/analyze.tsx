import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { HarvestAnalyzeView } from '@/features/harvests/components/HarvestAnalyzeView';
import { Permission } from '@futurefarm/types';

export interface InspectorAnalyzeSearchParams {
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
}

export const Route = createFileRoute('/inspector/harvests/analyze')({
  validateSearch: (search: Record<string, unknown>): InspectorAnalyzeSearchParams => {
    const res: InspectorAnalyzeSearchParams = {};
    if (typeof search['farmerUserId'] === 'string') res.farmerUserId = search['farmerUserId'];
    if (typeof search['farmerName'] === 'string') res.farmerName = search['farmerName'];
    return res;
  },
  beforeLoad: () => {
    requireAuth(
      [Permission.FARMER_PROXY_HARVEST_MANAGE, Permission.INSPECTION_CREATE, Permission.INSPECTION_READ],
      'any',
    );
    requireRole(['Inspector']);
  },
  component: InspectorAnalyzeHarvestPage,
});

function InspectorAnalyzeHarvestPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  return (
    <HarvestAnalyzeView
      isProxy
      farmerUserId={search.farmerUserId}
      farmerName={search.farmerName}
      onNavigateBack={() => {
        void navigate({ to: '/inspector/proxy', search: { tab: 'harvest' } });
      }}
      onProceedToForm={(params) => {
        void navigate({
          to: '/inspector/harvests/new',
          search: {
            ...params,
            farmerUserId: search.farmerUserId || params.farmerUserId,
            farmerName: search.farmerName || params.farmerName,
          },
        });
      }}
    />
  );
}
