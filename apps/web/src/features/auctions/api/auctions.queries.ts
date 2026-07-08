import { apiClient } from '@/lib/api-client';
import type {
  AuctionDto,
  BidDto,
  CreateAuctionDto,
  UpdateAuctionDto,
  AuctionStatus,
  PaginatedResult,
} from '@futurefarm/types';

export const getAuctionsQuery = (filters?: { status?: AuctionStatus; harvestId?: string; page?: number; limit?: number }) => ({
  queryKey: ['auctions', filters],
  queryFn: async (): Promise<PaginatedResult<AuctionDto>> => {
    const { data } = await apiClient.get<{ data: PaginatedResult<AuctionDto> }>('/auctions', { params: filters });
    return data.data;
  },
});

export const getAuctionDetailsQuery = (id: string) => ({
  queryKey: ['auctions', id],
  queryFn: async (): Promise<AuctionDto> => {
    const { data } = await apiClient.get<{ data: AuctionDto }>(`/auctions/${id}`);
    return data.data;
  },
});

export const getMyBidsQuery = () => ({
  queryKey: ['auctions', 'my-bids'],
  queryFn: async (): Promise<BidDto[]> => {
    const { data } = await apiClient.get<{ data: BidDto[] }>('/auctions/my-bids');
    return data.data;
  },
});

export const createAuctionMutation = () => ({
  mutationFn: async (payload: CreateAuctionDto): Promise<AuctionDto> => {
    const { data } = await apiClient.post<{ data: AuctionDto }>('/auctions', payload);
    return data.data;
  },
});

export const updateAuctionMutation = (id: string) => ({
  mutationFn: async (payload: UpdateAuctionDto): Promise<AuctionDto> => {
    const { data } = await apiClient.patch<{ data: AuctionDto }>(`/auctions/${id}`, payload);
    return data.data;
  },
});

export const cancelAuctionMutation = () => ({
  mutationFn: async (id: string): Promise<AuctionDto> => {
    const { data } = await apiClient.post<{ data: AuctionDto }>(`/auctions/${id}/cancel`);
    return data.data;
  },
});

export const placeBidMutation = () => ({
  mutationFn: async (id: string): Promise<BidDto> => {
    const { data } = await apiClient.post<{ data: BidDto }>(`/auctions/${id}/bids`);
    return data.data;
  },
});
