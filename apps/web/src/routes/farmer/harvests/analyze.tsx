import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import { HarvestAnalyzeView } from '@/features/harvests/components/HarvestAnalyzeView';
import { Permission } from '@futurefarm/types';

export interface AnalyzeSearch {
  productId?: string | undefined;
}

export const Route = createFileRoute('/farmer/harvests/analyze')({
  validateSearch: (search: Record<string, unknown>): AnalyzeSearch => ({
    productId: typeof search.productId === 'string' ? search.productId : undefined,
  }),
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_CREATE);
  },
  component: FarmerAnalyzePage,
});

function FarmerAnalyzePage() {
  useFarmerLayout({ hideTopBar: true, hideBottomNav: true });
  const { productId: initialProductId } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <HarvestAnalyzeView
      onNavigateBack={() => {
        void navigate({ to: '/farmer/stock' });
      }}
      onProceedToForm={(params) => {
        void navigate({
          to: '/farmer/harvests/new',
          search: {
            ...params,
            productId: params.productId || initialProductId || undefined,
          },
        });
      }}
    />
  );
}
