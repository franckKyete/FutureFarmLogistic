import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProducerDto, ProducerFilter } from '../types';

export function useProducers(filters: ProducerFilter) {
  return useQuery<ProducerDto[]>({
    queryKey: ['inspector', 'producers', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ProducerDto[] }>('/users', {
        params: filters,
      });
      return data.data;
    },
  });
}

export function useCreateProducer() {
  return useMutation({
    mutationFn: async (payload: { firstName: string; lastName: string; email: string; phone?: string; password: string; farmName: string }) => {
      const { data } = await apiClient.post<{ data: ProducerDto }>('/users/register/farmer/proxy', payload);
      return data.data;
    },
  });
}

export function useUpdateUserStatus() {
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch<{ data: ProducerDto }>(`/users/${id}/status`, { status });
      return data.data;
    },
  });
}
