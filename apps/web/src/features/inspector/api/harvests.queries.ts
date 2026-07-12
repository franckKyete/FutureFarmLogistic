import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { HarvestDto as InspectorHarvestDto } from '../types';

export function usePendingHarvests(status?: string) {
  return useQuery<InspectorHarvestDto[]>({
    queryKey: ['inspector', 'harvests', 'pending', status],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: InspectorHarvestDto[] }>('/harvests', {
        params: status ? { status } : {},
      });
      return data.data;
    },
  });
}

export function useVerifyHarvest() {
  return useMutation({
    mutationFn: async ({ id, status, qualityScore, rejectionReason }: { id: string; status: string; qualityScore?: number; rejectionReason?: string }) => {
      const { data } = await apiClient.patch<{ data: InspectorHarvestDto }>(`/harvests/${id}/verify`, {
        status,
        qualityScore,
        rejectionReason,
      });
      return data.data;
    },
  });
}
