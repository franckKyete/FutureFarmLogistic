import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { InspectorProfileDto, InspectionReportDto } from '@futurefarm/types';

// ---------------------------------------------------------------------------
// Inline DTOs (response shapes not yet exported from @futurefarm/types)
// ---------------------------------------------------------------------------

export interface InspectionCenterDto {
  id: string;
  name: string;
  code: string;
  regionName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Inspection Center hooks
// ---------------------------------------------------------------------------

export function useInspectionCenters() {
  return useQuery<InspectionCenterDto[]>({
    queryKey: ['admin', 'inspection-centers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: InspectionCenterDto[] }>(
        '/inspection-centers',
      );
      return data.data;
    },
  });
}

export function useCreateCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      regionName: string;
      address: string;
      latitude?: number;
      longitude?: number;
    }) => {
      const { data } = await apiClient.post<{ data: InspectionCenterDto }>(
        '/inspection-centers',
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-centers'] });
    },
  });
}

export function useDeleteCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inspection-centers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-centers'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Inspector Profile hooks
// ---------------------------------------------------------------------------

export function useInspectors() {
  return useQuery<InspectorProfileDto[]>({
    queryKey: ['admin', 'inspectors'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: InspectorProfileDto[] }>(
        '/inspections/profile',
      );
      return data.data;
    },
  });
}

export function useCreateInspectorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      licenseNumber: string;
      agencyName: string;
      specializations: string[];
    }) => {
      const { data } = await apiClient.post<{ data: InspectorProfileDto }>(
        '/inspections/profile',
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inspectors'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Inspector-to-Center assignment
// ---------------------------------------------------------------------------

export function useAssignInspectorToCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      inspectorProfileId,
    }: {
      id: string;
      inspectorProfileId: string;
    }) => {
      const { data } = await apiClient.post(
        `/inspection-centers/${id}/assign`,
        { inspectorProfileId },
      );
      return (data as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-centers'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Inspection Report hooks
// ---------------------------------------------------------------------------

export function useInspectionReports() {
  return useQuery<InspectionReportDto[]>({
    queryKey: ['admin', 'inspection-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: InspectionReportDto[] }>(
        '/inspections/reports',
      );
      return data.data;
    },
  });
}
