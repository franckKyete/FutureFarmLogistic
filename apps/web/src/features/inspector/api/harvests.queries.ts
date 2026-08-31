import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { HarvestDto as InspectorHarvestDto } from '../types';

export function usePendingHarvests(
  status?: string,
  centerId?: string,
  radiusKm?: number,
) {
  return useQuery<InspectorHarvestDto[]>({
    queryKey: ['inspector', 'harvests', 'pending', status, centerId, radiusKm],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (status) params.status = status;
      if (centerId) params.centerId = centerId;
      if (radiusKm) params.radiusKm = radiusKm;

      const { data } = await apiClient.get<{ data: any[] }>('/harvests', {
        params,
      });

      return (data.data || []).map(
        (h: any): InspectorHarvestDto => ({
          id: h.id,
          productId: h.productId,
          farmerProfileId: h.farmerProfileId ?? h.farmerProfile?.id,
          productName: h.product?.name ?? h.productName ?? 'Produit Agricole',
          producerName:
            h.farmerProfile?.user
              ? `${h.farmerProfile.user.firstName} ${h.farmerProfile.user.lastName}`
              : h.farmerProfile?.companyName ??
                h.producerName ??
                'Producteur local',
          quantity: Number(h.quantityInStock ?? h.quantity ?? 0),
          unit: h.unit ?? 'KG',
          qualityScore:
            h.qualityScore != null ? Number(h.qualityScore) : null,
          status: h.status,
          harvestDate: h.harvestDate,
          images: h.photoUrls ?? h.images ?? [],
          parcelId: h.parcelId,
          farmingMethods: h.farmingMethods,
          rejectionReason: h.rejectionReason,
        }),
      );
    },
  });
}

export function useVerifyHarvest() {
  return useMutation({
    mutationFn: async ({
      id,
      status,
      qualityScore,
      rejectionReason,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED' | 'FLAGGED_PHYSICAL' | string;
      qualityScore?: number;
      rejectionReason?: string;
    }) => {
      const { data } = await apiClient.patch<{ data: InspectorHarvestDto }>(
        `/harvests/${id}/verify`,
        {
          status,
          qualityScore,
          rejectionReason,
        },
      );
      return data.data;
    },
  });
}
