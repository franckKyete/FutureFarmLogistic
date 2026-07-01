import { apiClient } from '@/lib/api-client';

import type { AuthTokens, AuthUser } from '@futurefarm/types';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/**
 * TanStack Query mutation options factory for the login endpoint.
 *
 * Usage:
 *   const { mutate } = useMutation(loginMutation());
 */
export function loginMutation() {
  return {
    mutationKey: ['auth', 'login'] as const,
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', payload);
      return data.data;
    },
  };
}
