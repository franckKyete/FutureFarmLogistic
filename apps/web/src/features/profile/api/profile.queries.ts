import { apiClient } from '@/lib/api-client';
import type {
  FarmerProfileDto,
  BuyerProfileDto,
  ParcelDto,
} from '@futurefarm/types';

export const getBuyerProfileQuery = () => ({
  queryKey: ['profile', 'buyer'],
  queryFn: async (): Promise<BuyerProfileDto> => {
    const { data } = await apiClient.get<{ data: BuyerProfileDto }>('/users/profile/buyer');
    return data.data;
  },
});

export const updateBuyerProfileMutation = () => ({
  mutationFn: async (payload: Partial<BuyerProfileDto>): Promise<BuyerProfileDto> => {
    const { data } = await apiClient.put<{ data: BuyerProfileDto }>('/users/profile/buyer', payload);
    return data.data;
  },
});

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

export const getFarmerProfileByIdQuery = (id?: string) => ({
  queryKey: ['profile', 'farmer', id || 'me'],
  queryFn: async (): Promise<FarmerProfileDto & { user?: any }> => {
    const endpoint = id ? `/users/profile/farmer/${id}` : '/users/profile/farmer';
    const { data } = await apiClient.get<{ data: FarmerProfileDto & { user?: any } }>(endpoint);
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

export const uploadMediaFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
};

