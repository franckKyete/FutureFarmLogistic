import axios from 'axios';

import { getAccessToken, clearAuth } from '@/features/auth/store/auth.store';

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// --- Request interceptor: attach JWT ---
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: handle 401 globally ---
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired or invalid — clear auth and let the router redirect to login
      clearAuth();
    }
    return Promise.reject(error);
  },
);
