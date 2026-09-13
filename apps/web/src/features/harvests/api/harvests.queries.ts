import { apiClient } from '@/lib/api-client';
import type {
  ProductDto,
  CreateProductDto,
  HarvestDto,
  CreateHarvestDto,
  UpdateHarvestDto,
  AiSuggestHarvestResponseDto,
  AiClassifyHarvestDto,
  AiClassifyHarvestResponseDto,
  ProductCategory,
} from '@futurefarm/types';

export const createProductMutation = () => ({
  mutationFn: async (payload: CreateProductDto): Promise<ProductDto> => {
    const { data } = await apiClient.post<{ data: ProductDto }>('/products', payload);
    return data.data;
  },
});

export const getProductsQuery = (category?: ProductCategory) => ({
  queryKey: ['products', category],
  queryFn: async (): Promise<ProductDto[]> => {
    const { data } = await apiClient.get<{ data: ProductDto[] }>('/products', {
      params: { category },
    });
    return data.data;
  },
});

export const getFarmerHarvestsQuery = () => ({
  queryKey: ['harvests', 'farmer'],
  queryFn: async (): Promise<HarvestDto[]> => {
    const { data } = await apiClient.get<{ data: HarvestDto[] }>('/harvests/farmer');
    return data.data;
  },
});

export const getMarketplaceHarvestsQuery = (
  category?: ProductCategory | null,
  farmerProfileId?: string,
) => ({
  queryKey: ['marketplace-harvests', category, farmerProfileId],
  queryFn: async (): Promise<HarvestDto[]> => {
    const params: Record<string, any> = {};
    if (category) params.category = category;
    if (farmerProfileId) params.farmerProfileId = farmerProfileId;
    const { data } = await apiClient.get<{ data: HarvestDto[] | { data: HarvestDto[] } }>('/harvests', {
      params,
    });
    const res = data.data;
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },
});

export const getHarvestDetailsQuery = (id: string) => ({
  queryKey: ['harvests', id],
  queryFn: async (): Promise<HarvestDto> => {
    const { data } = await apiClient.get<{ data: HarvestDto }>(`/harvests/${id}`);
    return data.data;
  },
});

export const getHarvestsByProductQuery = (productId?: string) => ({
  queryKey: ['harvests', 'by-product', productId],
  queryFn: async (): Promise<HarvestDto[]> => {
    if (!productId) return [];
    const { data } = await apiClient.get<{ data: HarvestDto[] | { data: HarvestDto[] } }>('/harvests', {
      params: { productId },
    });
    const res = data.data;
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  },
  enabled: !!productId,
});

export const getDecayedPriceQuery = (id: string) => ({
  queryKey: ['harvests', id, 'price'],
  queryFn: async (): Promise<{ currentPrice: number; originalPrice: number; discountPercent: number }> => {
    const { data } = await apiClient.get<{ data: { currentPrice: number; originalPrice: number; discountPercent: number } }>(`/harvests/${id}/price`);
    return data.data;
  },
});

export const createHarvestMutation = () => ({
  mutationFn: async (payload: CreateHarvestDto): Promise<HarvestDto> => {
    const { data } = await apiClient.post<{ data: HarvestDto }>('/harvests', payload);
    return data.data;
  },
});

export const updateHarvestMutation = (id: string) => ({
  mutationFn: async (payload: UpdateHarvestDto): Promise<HarvestDto> => {
    const { data } = await apiClient.patch<{ data: HarvestDto }>(`/harvests/${id}`, payload);
    return data.data;
  },
});

export const deleteHarvestMutation = () => ({
  mutationFn: async (id: string): Promise<void> => {
    await apiClient.delete(`/harvests/${id}`);
  },
});

export const aiSuggestHarvestMutation = () => ({
  mutationFn: async (prompt: string): Promise<AiSuggestHarvestResponseDto> => {
    const { data } = await apiClient.post<{ data: AiSuggestHarvestResponseDto }>('/harvests/ai-suggest', { prompt });
    return data.data;
  },
});

export const aiClassifyHarvestMutation = () => ({
  mutationFn: async (payload: AiClassifyHarvestDto): Promise<AiClassifyHarvestResponseDto> => {
    const { data } = await apiClient.post<{ data: AiClassifyHarvestResponseDto }>('/harvests/ai-classify', payload);
    return data.data;
  },
});

export const mediaUploadMutation = () => ({
  mutationFn: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<{ data: { url: string } }>('/media/upload', formData);
    return data.data;
  },
});
