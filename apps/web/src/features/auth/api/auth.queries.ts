import { apiClient } from '@/lib/api-client';
import axios from 'axios';
import { BuyerBusinessType } from '@futurefarm/types';
import type { AuthTokens, AuthUser } from '@futurefarm/types';

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/v1';

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type LoginResponse =
  | { require2fa: false; user: AuthUser; tokens: AuthTokens }
  | { require2fa: true; tempToken: string };

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface Authenticate2faPayload {
  tempToken: string;
  code: string;
}

export interface RegisterFarmerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | undefined;
  companyName: string;
  address: string;
  regionName: string;
  bio?: string | undefined;
}

export interface RegisterBuyerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | undefined;
  country?: string | undefined;
  preferredCurrency?: string | undefined;
  companyName?: string | undefined;
  vatNumber?: string | undefined;
  businessType?: BuyerBusinessType | undefined;
  billingAddress: string;
  shippingAddress: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export async function refreshTokenRequest(
  refreshToken: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  // Use independent axios instance to prevent recursive interceptor loops
  const { data } = await axios.post<{ data: { user: AuthUser; tokens: AuthTokens } }>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { withCredentials: true },
  );
  return data.data;
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

export function refreshTokenMutation() {
  return {
    mutationKey: ['auth', 'refreshToken'] as const,
    mutationFn: async (payload: RefreshTokenPayload): Promise<{ user: AuthUser; tokens: AuthTokens }> => {
      return refreshTokenRequest(payload.refreshToken);
    },
  };
}

export function logoutMutation() {
  return {
    mutationKey: ['auth', 'logout'] as const,
    mutationFn: async (payload?: { refreshToken?: string }): Promise<{ success: boolean }> => {
      const { data } = await apiClient.post<{ data: { success: boolean } }>('/auth/logout', payload);
      return data.data;
    },
  };
}

export function forgotPasswordMutation() {
  return {
    mutationKey: ['auth', 'forgotPassword'] as const,
    mutationFn: async (payload: ForgotPasswordPayload): Promise<{ success: boolean }> => {
      const { data } = await apiClient.post<{ data: { success: boolean } }>('/auth/forgot-password', payload);
      return data.data;
    },
  };
}

export function resetPasswordMutation() {
  return {
    mutationKey: ['auth', 'resetPassword'] as const,
    mutationFn: async (payload: ResetPasswordPayload): Promise<{ success: boolean }> => {
      const { data } = await apiClient.post<{ data: { success: boolean } }>('/auth/reset-password', payload);
      return data.data;
    },
  };
}

export function authenticate2faMutation() {
  return {
    mutationKey: ['auth', 'authenticate2fa'] as const,
    mutationFn: async (payload: Authenticate2faPayload): Promise<{ user: AuthUser; tokens: AuthTokens }> => {
      const { data } = await apiClient.post<{ data: { user: AuthUser; tokens: AuthTokens } }>(
        '/auth/2fa/authenticate',
        payload,
      );
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

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export function changePasswordMutation() {
  return {
    mutationKey: ['auth', 'changePassword'] as const,
    mutationFn: async (payload: ChangePasswordPayload): Promise<{ success: boolean; message: string }> => {
      const { data } = await apiClient.post<{ data: { success: boolean; message: string } }>(
        '/auth/change-password',
        payload,
      );
      return data.data;
    },
  };
}
