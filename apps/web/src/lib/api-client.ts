import axios from 'axios';
import { getAccessToken, clearAuth } from '@/features/auth/store/auth.store';
import { addToast } from '@/features/shared/store/toast.store';

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
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

// --- Response interceptor: handle errors globally ---
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status) {
        if (status === 401) {
          clearAuth();
          addToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
          if (!window.location.pathname.startsWith('/auth/login') && !window.location.pathname.startsWith('/auth/register')) {
            const currentPath = window.location.pathname + window.location.search;
            const redirectParam = encodeURIComponent(currentPath);
            window.location.href = `/auth/login?redirect=${redirectParam}`;
          }
        } else if (status === 403) {
          addToast(`Accès refusé : ${message}`, 'error');
        } else if (status >= 500) {
          addToast('Une erreur interne du serveur est survenue.', 'error');
        } else if (status === 400) {
          addToast(`Données invalides : ${message}`, 'warning');
        }
      }
    }
    return Promise.reject(error);
  },
);
