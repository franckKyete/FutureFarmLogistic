import { apiClient } from '@/lib/api-client';
import type {
  InspectionReportDto,
  CreateInspectionReportDto,
  UpdateInspectionReportDto,
  SubmitInspectionReportDto,
  CreateInspectionPhotoDto,
  InspectionPhotoDto,
} from '@futurefarm/types';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getMyReportsQuery = () => ({
  queryKey: ['inspector', 'reports', 'me'] as const,
  queryFn: async (): Promise<InspectionReportDto[]> => {
    const { data } = await apiClient.get<{ data: InspectionReportDto[] }>(
      '/inspections/reports/me',
    );
    return data.data;
  },
});

export const getReportDetailsQuery = (id: string) => ({
  queryKey: ['inspector', 'reports', id] as const,
  queryFn: async (): Promise<InspectionReportDto> => {
    const { data } = await apiClient.get<{ data: InspectionReportDto }>(
      `/inspections/reports/${id}`,
    );
    return data.data;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const createReportMutation = () => ({
  mutationFn: async (dto: CreateInspectionReportDto): Promise<InspectionReportDto> => {
    const { data } = await apiClient.post<{ data: InspectionReportDto }>(
      '/inspections/reports',
      dto,
    );
    return data.data;
  },
});

export const updateReportMutation = () => ({
  mutationFn: async ({
    id,
    dto,
  }: {
    id: string;
    dto: UpdateInspectionReportDto;
  }): Promise<InspectionReportDto> => {
    const { data } = await apiClient.patch<{ data: InspectionReportDto }>(
      `/inspections/reports/${id}`,
      dto,
    );
    return data.data;
  },
});

export const addReportPhotoMutation = () => ({
  mutationFn: async ({
    id,
    dto,
  }: {
    id: string;
    dto: CreateInspectionPhotoDto;
  }): Promise<InspectionPhotoDto> => {
    const { data } = await apiClient.post<{ data: InspectionPhotoDto }>(
      `/inspections/reports/${id}/photos`,
      dto,
    );
    return data.data;
  },
});

export const removeReportPhotoMutation = () => ({
  mutationFn: async ({ id, photoId }: { id: string; photoId: string }) => {
    await apiClient.delete(`/inspections/reports/${id}/photos/${photoId}`);
  },
});

export const aiScreenMutation = () => ({
  mutationFn: async (id: string): Promise<InspectionReportDto> => {
    const { data } = await apiClient.post<{ data: InspectionReportDto }>(
      `/inspections/reports/${id}/ai-screen`,
    );
    return data.data;
  },
});

export const submitReportMutation = () => ({
  mutationFn: async ({
    id,
    dto,
  }: {
    id: string;
    dto: SubmitInspectionReportDto;
  }): Promise<InspectionReportDto> => {
    const { data } = await apiClient.post<{ data: InspectionReportDto }>(
      `/inspections/reports/${id}/submit`,
      dto,
    );
    return data.data;
  },
});
