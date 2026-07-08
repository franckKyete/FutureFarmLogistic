import { apiClient } from '@/lib/api-client';
import type {
  NotificationDto,
  NotificationPreferencesDto,
  PaginatedResult,
} from '@futurefarm/types';

export const getMyNotificationsQuery = (filters?: { page?: number; limit?: number }) => ({
  queryKey: ['notifications', 'me', filters],
  queryFn: async (): Promise<PaginatedResult<NotificationDto>> => {
    const { data } = await apiClient.get<{ data: PaginatedResult<NotificationDto> }>('/notifications/me', { params: filters });
    return data.data;
  },
});

export const getUnreadNotificationsCountQuery = () => ({
  queryKey: ['notifications', 'unread-count'],
  queryFn: async (): Promise<{ count: number }> => {
    const { data } = await apiClient.get<{ data: { count: number } }>('/notifications/me/unread-count');
    return data.data;
  },
});

export const markNotificationReadMutation = () => ({
  mutationFn: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/me/${id}/read`);
  },
});

export const markAllNotificationsReadMutation = () => ({
  mutationFn: async (): Promise<void> => {
    await apiClient.patch('/notifications/me/read-all');
  },
});

export const deleteNotificationMutation = () => ({
  mutationFn: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/me/${id}`);
  },
});

export const getNotificationPreferencesQuery = () => ({
  queryKey: ['notifications', 'preferences'],
  queryFn: async (): Promise<NotificationPreferencesDto> => {
    const { data } = await apiClient.get<{ data: NotificationPreferencesDto }>('/notifications/me/preferences');
    return data.data;
  },
});

export const updateNotificationPreferencesMutation = () => ({
  mutationFn: async (payload: Partial<NotificationPreferencesDto>): Promise<NotificationPreferencesDto> => {
    const { data } = await apiClient.put<{ data: NotificationPreferencesDto }>('/notifications/me/preferences', payload);
    return data.data;
  },
});
