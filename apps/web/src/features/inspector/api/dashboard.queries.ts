import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DashboardStats } from '../types';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['inspector', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DashboardStats }>('/visits/dashboard');
      return data.data;
    },
    refetchInterval: 30000,
  });
}
