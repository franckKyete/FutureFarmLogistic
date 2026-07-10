import { apiClient } from '@/lib/api-client';

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
