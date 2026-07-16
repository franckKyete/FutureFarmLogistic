import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { OrderDto } from '@futurefarm/types';

export function useAllOrders(page: number = 1, limit: number = 20) {
  return useQuery<OrderDto[]>({
    queryKey: ['admin', 'orders', { page, limit }],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { data: OrderDto[]; meta: unknown };
      }>('/orders/all', {
        params: { page, limit },
      });
      return data.data.data;
    },
  });
}
