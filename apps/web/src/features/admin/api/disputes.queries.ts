import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Dispute, CreateDisputeDto, UpdateDisputeDto, ResolveDisputeDto } from '@futurefarm/types';

export function useDisputes() {
  return useQuery<Dispute[]>({
    queryKey: ['disputes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Dispute[] }>('/disputes');
      return data.data;
    },
  });
}

export function useDispute(id: string) {
  return useQuery<Dispute>({
    queryKey: ['disputes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Dispute }>(`/disputes/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDisputeDto) => {
      const { data } = await apiClient.post<{ data: Dispute }>('/disputes', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}

export function useUpdateDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateDisputeDto) => {
      const { data } = await apiClient.patch<{ data: Dispute }>(`/disputes/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}

export function useResolveDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & ResolveDisputeDto) => {
      const { data } = await apiClient.patch<{ data: Dispute }>(`/disputes/${id}/resolve`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}

export function useDeleteDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/disputes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}
