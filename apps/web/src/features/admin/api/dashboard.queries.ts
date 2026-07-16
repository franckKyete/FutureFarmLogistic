import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single item in recentOrders from GET /admin/dashboard */
export interface RecentOrderItem {
  id: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  pendingValidations: number;
  activeAuctions: number;
  activeRuns: number;
  pendingInspections: number;
  openDisputes: number;
  monthlyRevenue: number;
  recentOrders: RecentOrderItem[];
}

export interface AnalyticsData {
  /** Last 12 months of aggregated order revenue */
  revenueByMonth: Array<{ month: string; revenue: number }>;
  /** Count of orders grouped by status */
  ordersByStatus: Record<string, number>;
  /** Count of users grouped by role name */
  usersByRole: Record<string, number>;
  /** Top products by order volume */
  topProducts: Array<{ id: string; name: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

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
  return useQuery<AnalyticsData>({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AnalyticsData }>('/admin/analytics');
      return data.data;
    },
  });
}
