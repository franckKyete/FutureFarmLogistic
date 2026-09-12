import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import {
  HarvestFormView,
  type HarvestFormSearchParams,
} from '@/features/harvests/components/HarvestFormView';
import { Permission } from '@futurefarm/types';

export const Route = createFileRoute('/inspector/harvests/new')({
  validateSearch: (search: Record<string, unknown>): HarvestFormSearchParams => {
    const res: HarvestFormSearchParams = {};
    if (typeof search['isIdentified'] === 'string') res.isIdentified = search['isIdentified'];
    if (typeof search['productId'] === 'string') res.productId = search['productId'];
    if (typeof search['quantity'] === 'string') res.quantity = search['quantity'];
    if (typeof search['pricePerUnit'] === 'string') res.pricePerUnit = search['pricePerUnit'];
    if (typeof search['shelfLifeDays'] === 'string') res.shelfLifeDays = search['shelfLifeDays'];
    if (typeof search['farmingMethods'] === 'string') res.farmingMethods = search['farmingMethods'];
    if (typeof search['photoUrl'] === 'string') res.photoUrl = search['photoUrl'];
    if (typeof search['photoUrls'] === 'string') res.photoUrls = search['photoUrls'];
    if (typeof search['featuredPhotoIndex'] === 'string') res.featuredPhotoIndex = search['featuredPhotoIndex'];
    if (typeof search['qualityScore'] === 'string') res.qualityScore = search['qualityScore'];
    if (typeof search['draftId'] === 'string') res.draftId = search['draftId'];
    if (typeof search['reviewDraftId'] === 'string') res.reviewDraftId = search['reviewDraftId'];
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
  component: InspectorAddHarvestPage,
});

function InspectorAddHarvestPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  return (
    <HarvestFormView
      isProxy
      farmerUserId={search.farmerUserId}
      farmerName={search.farmerName}
      searchParams={search}
      onNavigateBack={() => {
        void navigate({ to: '/inspector/proxy', search: { tab: 'harvest' } });
      }}
      onSuccessRedirect={() => {
        void navigate({ to: '/inspector/proxy', search: { tab: 'harvest' } });
      }}
    />
  );
}
