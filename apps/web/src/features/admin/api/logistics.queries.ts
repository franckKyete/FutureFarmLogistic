import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  CreateVehicleDto,
  UpdateVehicleDto,
  AssignDriverDto,
  AssignVehicleDto,
} from '@futurefarm/types';

// ---------------------------------------------------------------------------
// Inline DTOs (response shapes not yet exported from @futurefarm/types)
// ---------------------------------------------------------------------------

export interface VehicleDto {
  id: string;
  registrationPlate: string;
  type: string;
  capacityKg: number;
  capacityM3: number;
  isActive: boolean;
  currentDriverId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverProfileDto {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiresAt: string | null;
  isAvailable: boolean;
  user?: { firstName: string; lastName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRunDto {
  id: string;
  status: string;
  driverId: string | null;
  vehicleId: string | null;
  scheduledAt: string;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  vehicle?: {
    id: string;
    registrationPlate: string;
    type: string;
    capacityKg: number;
    capacityM3: number;
    isActive: boolean;
  } | null;
  stops?: Array<{
    id: string;
    orderLineId: string;
    type: string;
    sequence: number;
    status: string;
    address: {
      street: string;
      city: string;
      lat: number;
      lon: number;
    };
    eta: string | null;
    completedAt: string | null;
    notes: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Vehicle hooks
// ---------------------------------------------------------------------------

export function useVehicles() {
  return useQuery<VehicleDto[]>({
    queryKey: ['admin', 'vehicles'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: VehicleDto[] }>(
        '/logistics/vehicles',
      );
      return data.data;
    },
  });
}

export function useVehicle(id: string) {
  return useQuery<VehicleDto>({
    queryKey: ['admin', 'vehicles', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: VehicleDto }>(
        `/logistics/vehicles/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateVehicleDto) => {
      const { data } = await apiClient.post<{ data: VehicleDto }>(
        '/logistics/vehicles',
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateVehicleDto) => {
      const { data } = await apiClient.patch<{ data: VehicleDto }>(
        `/logistics/vehicles/${id}`,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/logistics/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Driver hooks
// ---------------------------------------------------------------------------

export function useDrivers() {
  return useQuery<DriverProfileDto[]>({
    queryKey: ['admin', 'drivers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { data: DriverProfileDto[]; meta: unknown };
      }>('/logistics/drivers');
      return data.data.data;
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      licenseNumber: string;
      licenseCategory: string;
      licenseExpiresAt?: string;
    }) => {
      const { data } = await apiClient.post<{ data: DriverProfileDto }>(
        '/logistics/drivers',
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/logistics/drivers/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Delivery Run hooks
// ---------------------------------------------------------------------------

export function useDeliveryRuns() {
  return useQuery<DeliveryRunDto[]>({
    queryKey: ['admin', 'runs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { data: DeliveryRunDto[]; meta: unknown };
      }>('/logistics/runs');
      return data.data.data;
    },
  });
}

export function useAssignDriverToRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string } & AssignDriverDto) => {
      const { data } = await apiClient.post<{ data: DeliveryRunDto }>(
        `/logistics/runs/${id}/assign-driver`,
        dto,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'runs'] });
    },
  });
}

export function useAssignVehicleToRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string } & AssignVehicleDto) => {
      const { data } = await apiClient.post<{ data: DeliveryRunDto }>(
        `/logistics/runs/${id}/assign-vehicle`,
        dto,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'runs'] });
    },
  });
}
