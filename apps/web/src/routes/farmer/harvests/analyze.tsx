import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import { HarvestAnalyzeView } from '@/features/harvests/components/HarvestAnalyzeView';
import { Permission } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/harvests/analyze')({
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_CREATE);
  },
  component: FarmerAnalyzePage,
});

function FarmerAnalyzePage() {
  useFarmerLayout({ hideTopBar: true, hideBottomNav: true });
  const navigate = useNavigate();

  return (
    <HarvestAnalyzeView
      onNavigateBack={() => {
        void navigate({ to: '/farmer/stock' });
      }}
      onProceedToForm={(params) => {
        void navigate({
          to: '/farmer/harvests/new',
          search: params,
        });
      }}
    />
  );
}
