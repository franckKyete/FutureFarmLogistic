import { apiClient } from '@/lib/api-client';
import type {
  FarmerProfileDto,
  ParcelDto,
} from '@futurefarm/types';

export interface CreateParcelPayload {
  cadastralNumber: string;
  sizeHectares: number;
  locationCoordinates: string;
  cropTypes: string[];
}

export const getFarmerProfileQuery = () => ({
  queryKey: ['profile', 'farmer'],
  queryFn: async (): Promise<FarmerProfileDto> => {
    const { data } = await apiClient.get<{ data: FarmerProfileDto }>('/users/profile/farmer');
    return data.data;
  },
});

export const updateFarmerProfileMutation = () => ({
  mutationFn: async (payload: Partial<FarmerProfileDto>): Promise<FarmerProfileDto> => {
    const { data } = await apiClient.put<{ data: FarmerProfileDto }>('/users/profile/farmer', payload);
    return data.data;
  },
});

export const getFarmerParcelsQuery = () => ({
  queryKey: ['parcels', 'me'],
  queryFn: async (): Promise<ParcelDto[]> => {
    const { data } = await apiClient.get<{ data: ParcelDto[] }>('/users/parcels/me');
    return data.data;
  },
});

export const createParcelMutation = () => ({
  mutationFn: async (payload: CreateParcelPayload): Promise<ParcelDto> => {
    const { data } = await apiClient.post<{ data: ParcelDto }>('/users/parcels', payload);
    return data.data;
  },
});
