import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DashboardStats {
  totalUsers: number;
  pendingValidations: number;
  activeAuctions: number;
  activeRuns: number;
  pendingInspections: number;
  openDisputes: number;
  monthlyRevenue: number;
  recentOrders: unknown[];
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DashboardStats }>('/admin/dashboard');
      return data.data;
    },
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics');
      return data.data;
    },
  });
}
