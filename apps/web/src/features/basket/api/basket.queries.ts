import { apiClient } from '@/lib/api-client';
import type {
  BasketDto,
  BasketLineDto,
  AddBasketLineDto,
  UpdateBasketLineDto,
  CheckoutDto,
} from '@futurefarm/types';

export const getBasketQuery = () => ({
  queryKey: ['basket'],
  queryFn: async (): Promise<BasketDto> => {
    const { data } = await apiClient.get<{ data: BasketDto }>(`/basket`);
    return data.data;
  },
});

export const addBasketLineMutation = () => ({
  mutationFn: async (payload: AddBasketLineDto): Promise<BasketLineDto> => {
    const { data } = await apiClient.post<{ data: BasketLineDto }>(`/basket/lines`, payload);
    return data.data;
  },
});

export const updateBasketLineMutation = (lineId: string) => ({
  mutationFn: async (payload: UpdateBasketLineDto): Promise<BasketLineDto> => {
    const { data } = await apiClient.patch<{ data: BasketLineDto }>(`/basket/lines/${lineId}`, payload);
    return data.data;
  },
});

export const removeBasketLineMutation = (lineId: string) => ({
  mutationFn: async (): Promise<void> => {
    await apiClient.delete(`/basket/lines/${lineId}`);
  },
});

export const checkoutMutation = () => ({
  mutationFn: async (payload: CheckoutDto): Promise<{ order: any; paymentUrl?: string }> => {
    const { data } = await apiClient.post<{ data: { order: any; paymentUrl?: string } }>(`/basket/checkout`, payload);
    return data.data;
  },
});
