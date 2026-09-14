import { apiClient } from '@/lib/api-client';
import type {
  AuctionDto,
  BidDto,
  CreateAuctionDto,
  UpdateAuctionDto,
  AuctionStatus,
  PaginatedResult,
} from '@futurefarm/types';

export const getAuctionsQuery = (filters?: { status?: AuctionStatus; harvestId?: string; farmerProfileId?: string; page?: number; limit?: number }) => ({
  queryKey: ['auctions', filters],
  queryFn: async (): Promise<PaginatedResult<AuctionDto>> => {
    const { data } = await apiClient.get<{ data: PaginatedResult<AuctionDto> }>('/auctions', { params: filters });
    return data.data;
  },
});

export const getFarmerAuctionsQuery = (filters?: { status?: AuctionStatus; page?: number; limit?: number }) => ({
  queryKey: ['auctions', 'farmer', filters],
  queryFn: async (): Promise<PaginatedResult<AuctionDto>> => {
    const { data } = await apiClient.get<{ data: PaginatedResult<AuctionDto> }>('/auctions/farmer', { params: filters });
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

export const getAuctionBidsQuery = (auctionId: string) => ({
  queryKey: ['auctions', auctionId, 'bids'],
  queryFn: async (): Promise<BidDto[]> => {
    const { data } = await apiClient.get<{ data: BidDto[] }>(`/auctions/${auctionId}/bids`);
    return data.data;
  },
  enabled: !!auctionId,
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

export interface SavedPaymentMethod {
  hasPaymentMethod: boolean;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export const getPaymentMethodQuery = () => ({
  queryKey: ['users', 'me', 'payment-method'],
  queryFn: async (): Promise<SavedPaymentMethod> => {
    const { data } = await apiClient.get<{ data: SavedPaymentMethod }>('/users/me/payment-method');
    return data.data;
  },
});

export const createSetupSessionMutation = () => ({
  mutationFn: async (payload?: {
    returnUrl?: string;
    auctionId?: string;
  }): Promise<{ sessionId: string; sessionUrl: string }> => {
    const { data } = await apiClient.post<{
      data: { sessionId: string; sessionUrl: string };
    }>('/users/me/payment-method/setup-session', payload || {});
    return data.data;
  },
});

export const confirmSetupSessionMutation = () => ({
  mutationFn: async (payload: {
    sessionId: string;
  }): Promise<SavedPaymentMethod> => {
    const { data } = await apiClient.post<{ data: SavedPaymentMethod }>(
      '/users/me/payment-method/confirm-setup-session',
      payload,
    );
    return data.data;
  },
});

export const createSetupIntentMutation = () => ({
  mutationFn: async (): Promise<{ clientSecret: string }> => {
    const { data } = await apiClient.post<{ data: { clientSecret: string } }>(
      '/users/me/payment-method/setup-intent',
    );
    return data.data;
  },
});

export const attachPaymentMethodMutation = () => ({
  mutationFn: async (payload: { paymentMethodId: string }): Promise<SavedPaymentMethod> => {
    const { data } = await apiClient.post<{ data: SavedPaymentMethod }>(
      '/users/me/payment-method/attach',
      payload,
    );
    return data.data;
  },
});

export const detachPaymentMethodMutation = () => ({
  mutationFn: async (): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete<{ data: { success: boolean } }>(
      '/users/me/payment-method',
    );
    return data.data;
  },
});

export const placeBidMutation = () => ({
  mutationFn: async (
    payload:
      | {
          id: string;
          autoBidMaxPrice?: number | undefined;
          deliveryAddress?: any;
        }
      | string,
  ): Promise<BidDto> => {
    const auctionId = typeof payload === 'string' ? payload : payload.id;
    let body: any = undefined;
    if (typeof payload === 'object') {
      body = {};
      if (payload.autoBidMaxPrice !== undefined) {
        body.autoBidMaxPrice = payload.autoBidMaxPrice;
      }
      if (payload.deliveryAddress !== undefined) {
        body.deliveryAddress = payload.deliveryAddress;
      }
      if (Object.keys(body).length === 0) {
        body = undefined;
      }
    }
    const { data } = await apiClient.post<{ data: BidDto }>(
      `/auctions/${auctionId}/bids`,
      body,
    );
    return data.data;
  },
});

export const cancelBidMutation = () => ({
  mutationFn: async (id: string): Promise<BidDto> => {
    const { data } = await apiClient.post<{ data: BidDto }>(`/auctions/${id}/cancel-bid`);
    return data.data;
  },
});
