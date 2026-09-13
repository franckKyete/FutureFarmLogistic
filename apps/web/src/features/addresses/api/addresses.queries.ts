import { apiClient } from '@/lib/api-client';
import type { AddressDto, CreateAddressDto, UpdateAddressDto } from '@futurefarm/types';

export const getMyAddressesQuery = () => ({
  queryKey: ['addresses', 'me'],
  queryFn: async (): Promise<AddressDto[]> => {
    const { data } = await apiClient.get<{ data: AddressDto[] }>('/addresses/me');
    return data.data;
  },
});

export const createAddressMutation = () => ({
  mutationFn: async (dto: CreateAddressDto): Promise<AddressDto> => {
    const { data } = await apiClient.post<{ data: AddressDto }>('/addresses/me', dto);
    return data.data;
  },
});

export const updateAddressMutation = (id: string) => ({
  mutationFn: async (dto: UpdateAddressDto): Promise<AddressDto> => {
    const { data } = await apiClient.patch<{ data: AddressDto }>(`/addresses/${id}`, dto);
    return data.data;
  },
});

export const setDefaultAddressMutation = () => ({
  mutationFn: async (id: string): Promise<AddressDto> => {
    const { data } = await apiClient.post<{ data: AddressDto }>(`/addresses/${id}/set-default`);
    return data.data;
  },
});

export const deleteAddressMutation = () => ({
  mutationFn: async (id: string): Promise<void> => {
    await apiClient.delete(`/addresses/${id}`);
  },
});
