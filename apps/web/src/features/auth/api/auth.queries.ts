import { apiClient } from '@/lib/api-client';
import { BuyerBusinessType } from '@futurefarm/types';
import type { AuthTokens, AuthUser } from '@futurefarm/types';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RegisterFarmerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  companyName: string;
  address: string;
  bio?: string;
}

export interface RegisterBuyerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  companyName: string;
  vatNumber: string;
  businessType: BuyerBusinessType;
  billingAddress: string;
  shippingAddress: string;
}

export function loginMutation() {
  return {
    mutationKey: ['auth', 'login'] as const,
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', payload);
      return data.data;
    },
  };
}

export function registerFarmerMutation() {
  return {
    mutationKey: ['auth', 'registerFarmer'] as const,
    mutationFn: async (payload: RegisterFarmerPayload): Promise<AuthUser> => {
      const { data } = await apiClient.post<{ data: AuthUser }>('/users/register/farmer', payload);
      return data.data;
    },
  };
}

export function registerBuyerMutation() {
  return {
    mutationKey: ['auth', 'registerBuyer'] as const,
    mutationFn: async (payload: RegisterBuyerPayload): Promise<AuthUser> => {
      const { data } = await apiClient.post<{ data: AuthUser }>('/users/register/buyer', payload);
      return data.data;
    },
  };
}
