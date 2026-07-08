import { apiClient } from '@/lib/api-client';
import type {
  OrderDto,
  OrderLineDto,
  RejectOrderLineDto,
} from '@futurefarm/types';

export const getSellerOrdersQuery = () => ({
  queryKey: ['orders', 'seller'],
  queryFn: async (): Promise<OrderLineDto[]> => {
    const { data } = await apiClient.get<{ data: OrderLineDto[] }>('/orders/seller');
    return data.data;
  },
});

export const getOrderDetailsQuery = (id: string) => ({
  queryKey: ['orders', id],
  queryFn: async (): Promise<OrderDto> => {
    const { data } = await apiClient.get<{ data: OrderDto }>(`/orders/${id}`);
    return data.data;
  },
});

export const confirmOrderLineMutation = (id: string, lineId: string) => ({
  mutationFn: async (): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(`/orders/${id}/confirm-line/${lineId}`);
    return data.data;
  },
});

export const rejectOrderLineMutation = (id: string, lineId: string) => ({
  mutationFn: async (payload: RejectOrderLineDto): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(`/orders/${id}/reject-line/${lineId}`, payload);
    return data.data;
  },
});

export const shipOrderLinesMutation = (id: string) => ({
  mutationFn: async (): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(`/orders/${id}/ship`);
    return data.data;
  },
});

export const deliverOrderLinesMutation = (id: string) => ({
  mutationFn: async (): Promise<OrderDto> => {
    const { data } = await apiClient.post<{ data: OrderDto }>(`/orders/${id}/deliver`);
    return data.data;
  },
});
