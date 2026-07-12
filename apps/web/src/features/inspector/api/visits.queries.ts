import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { VisitDto, CreateVisitDto, UpdateVisitDto, VisitFilter } from '../types';

export function useVisits(filters?: VisitFilter) {
  return useQuery<VisitDto[]>({
    queryKey: ['inspector', 'visits', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: VisitDto[] }>('/visits', {
        params: filters,
      });
      return data.data;
    },
  });
}

export function useCreateVisit() {
  return useMutation({
    mutationFn: async (payload: CreateVisitDto) => {
      const { data } = await apiClient.post<{ data: VisitDto }>('/visits', payload);
      return data.data;
    },
  });
}

export function useUpdateVisit() {
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateVisitDto) => {
      const { data } = await apiClient.patch<{ data: VisitDto }>(`/visits/${id}`, payload);
      return data.data;
    },
  });
}

export function useDeleteVisit() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/visits/${id}`);
    },
  });
}
