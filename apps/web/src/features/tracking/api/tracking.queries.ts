import { apiClient } from '@/lib/api-client';
import type { DeliveryRunDto, DriverProfileDto } from '@/features/admin/api/logistics.queries';
import type { PushLocationDto, SkipStopDto } from '@futurefarm/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape of GET /logistics/runs/:id/location */
export interface RunLocationDto {
  lat: number;
  lon: number;
  heading?: number;
  speedKmh?: number;
  recordedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getRunLocationQuery = (runId: string) => ({
  queryKey: ['tracking', 'runs', runId],
  queryFn: async (): Promise<RunLocationDto> => {
    const { data } = await apiClient.get<{ data: RunLocationDto }>(
      `/logistics/runs/${runId}/location`,
    );
    return data.data;
  },
});

export const getMyRunsQuery = () => ({
  queryKey: ['driver', 'my-runs'] as const,
  queryFn: async (): Promise<DeliveryRunDto[]> => {
    const { data } = await apiClient.get<{ data: DeliveryRunDto[] }>('/logistics/runs/my');
    return data.data;
  },
});

export const getRunDetailsQuery = (id: string) => ({
  queryKey: ['driver', 'runs', id] as const,
  queryFn: async (): Promise<DeliveryRunDto> => {
    const { data } = await apiClient.get<{ data: DeliveryRunDto }>(`/logistics/runs/${id}`);
    return data.data;
  },
});

export const getMyDriverProfileQuery = () => ({
  queryKey: ['driver', 'profile', 'me'] as const,
  queryFn: async (): Promise<DriverProfileDto> => {
    const { data } = await apiClient.get<{ data: DriverProfileDto }>(
      '/logistics/drivers/profile/me',
    );
    return data.data;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const startRunMutation = () => ({
  mutationFn: async (runId: string): Promise<DeliveryRunDto> => {
    const { data } = await apiClient.post<{ data: DeliveryRunDto }>(`/logistics/runs/${runId}/start`);
    return data.data;
  },
});

export const arriveAtStopMutation = () => ({
  mutationFn: async ({ runId, stopId }: { runId: string; stopId: string }) => {
    const { data } = await apiClient.post(`/logistics/runs/${runId}/stops/${stopId}/arrive`);
    return data.data;
  },
});

export const completeStopMutation = () => ({
  mutationFn: async ({ runId, stopId }: { runId: string; stopId: string }) => {
    const { data } = await apiClient.post(`/logistics/runs/${runId}/stops/${stopId}/complete`);
    return data.data;
  },
});

export const skipStopMutation = () => ({
  mutationFn: async ({ runId, stopId, dto }: { runId: string; stopId: string; dto: SkipStopDto }) => {
    const { data } = await apiClient.post(`/logistics/runs/${runId}/stops/${stopId}/skip`, dto);
    return data.data;
  },
});

export const uploadStopProofMutation = () => ({
  mutationFn: async ({ runId, stopId, file }: { runId: string; stopId: string; file: File }) => {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await apiClient.post(`/logistics/runs/${runId}/stops/${stopId}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
});

export const pushLocationMutation = () => ({
  mutationFn: async (dto: PushLocationDto) => {
    const { data } = await apiClient.post('/logistics/location', dto);
    return data.data;
  },
});

export const updateDriverAvailabilityMutation = () => ({
  mutationFn: async (isAvailable: boolean) => {
    const { data } = await apiClient.patch('/logistics/drivers/profile/me', { isAvailable });
    return data.data;
  },
});
