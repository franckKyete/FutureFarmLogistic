import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AdminUserDto, AdminRoleDto } from '../types';
import type { PaginationQuery } from '@futurefarm/types';

export function useUsers(params: PaginationQuery = {}) {
  return useQuery<AdminUserDto[]>({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { data: AdminUserDto[]; meta: unknown } }>('/users', { params });
      return data.data.data;
    },
  });
}

export function useUser(id: string) {
  return useQuery<AdminUserDto>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminUserDto }>(`/users/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch<{ data: AdminUserDto }>(`/users/${id}/status`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useRoles() {
  return useQuery<AdminRoleDto[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminRoleDto[] }>('/roles');
      return data.data;
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { data } = await apiClient.post<{ data: AdminUserDto }>('/roles/assign', { userId, roleId });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}
