import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AdminHarvestDto {
  id: string;
  productId: string;
  farmerProfileId: string;
  parcelId?: string;
  harvestDate: string;
  expirationDate: string;
  quantityInStock: number;
  stockMarge: number;
  pricePerUnit: number;
  unit: 'KG' | 'TON' | 'PIECE';
  farmingMethods: string;
  photoUrls: string[];
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  qualityScore?: number;
  rejectionReason?: string;
  product?: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
  farmerProfile?: {
    id: string;
    companyName: string;
    address: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export function usePendingHarvests() {
  return useQuery<AdminHarvestDto[]>({
    queryKey: ['admin', 'harvests', 'pending'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminHarvestDto[]>('/products/harvests', {
        params: { status: 'PENDING_APPROVAL' },
      });
      return data;
    },
  });
}

export function useVerifyHarvest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      qualityScore,
      rejectionReason,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      qualityScore?: number;
      rejectionReason?: string;
    }) => {
      const { data } = await apiClient.patch<AdminHarvestDto>(`/products/harvests/${id}/verify`, {
        status,
        qualityScore,
        rejectionReason,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'harvests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
