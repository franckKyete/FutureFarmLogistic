import { apiClient } from '@/lib/api-client';
import type { OrderDto } from '@futurefarm/types';

export const getMyOrdersQuery = () => ({
  queryKey: ['orders', 'my'] as const,
  queryFn: async (): Promise<OrderDto[]> => {
    const { data } = await apiClient.get<{ data: OrderDto[] }>('/orders');
    return data.data;
  },
});

export const getOrderDetailsQuery = (id: string) => ({
  queryKey: ['orders', id] as const,
  queryFn: async (): Promise<OrderDto> => {
    const { data } = await apiClient.get<{ data: OrderDto }>(`/orders/${id}`);
    return data.data;
  },
});

export const cancelOrderMutation = () => ({
  mutationFn: async (id: string): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(`/orders/${id}/cancel`);
    return data.data;
  },
});

export const confirmPaymentMutation = () => ({
  mutationFn: async (payload: { paymentRef: string }): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(
      '/orders/payments/confirm',
      null,
      { params: payload },
    );
    return data.data;
  },
});
