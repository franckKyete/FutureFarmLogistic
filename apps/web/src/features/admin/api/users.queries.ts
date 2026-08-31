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

export interface CreateInspectorParams {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  licenseNumber?: string;
  agencyName?: string;
  specializations?: string[];
}

export interface CreateDriverParams {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiresAt?: string;
}

export function useCreateInspector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateInspectorParams) => {
      const { data } = await apiClient.post<{ data: AdminUserDto }>(
        '/users/register/inspector',
        params,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateDriverParams) => {
      const { data } = await apiClient.post<{ data: AdminUserDto }>(
        '/users/register/driver',
        params,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useResendWelcomeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post<{ message: string }>(
        `/users/${userId}/resend-welcome`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export interface UpdateUserParams {
  id: string;
  email?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phoneNumber?: string | undefined;
  licenseNumber?: string | undefined;
  licenseCategory?: string | undefined;
  isAvailable?: boolean | undefined;
  agencyName?: string | undefined;
  specializations?: string[] | undefined;
  companyName?: string | undefined;
  address?: string | undefined;
  bio?: string | undefined;
  vatNumber?: string | undefined;
  billingAddress?: string | undefined;
  shippingAddress?: string | undefined;
  isCertified?: boolean | undefined;
  avatarUrl?: string | undefined;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...params }: UpdateUserParams) => {
      const { data } = await apiClient.patch<{ data: AdminUserDto }>(`/users/${id}`, params);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.id] });
    },
  });
}
