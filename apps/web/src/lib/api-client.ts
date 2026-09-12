import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setAuth, clearAuth } from '@/features/auth/store/auth.store';
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

// --- Refresh Token Queue State ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// --- Response interceptor: handle errors & transparent token refresh ---
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
      const url = originalRequest?.url || '';

      const isAuthRequest =
        url.includes('/auth/login') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password') ||
        url.includes('/auth/2fa');

      if (status === 401 && !isAuthRequest && originalRequest) {
        if (originalRequest._retry) {
          // If already retried once and still 401, expire session
          clearAuth();
          addToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
          if (
            !window.location.pathname.startsWith('/auth/login') &&
            !window.location.pathname.startsWith('/auth/register')
          ) {
            const currentPath = window.location.pathname + window.location.search;
            const redirectParam = encodeURIComponent(currentPath);
            window.location.href = `/auth/login?redirect=${redirectParam}`;
          }
          return Promise.reject(error);
        }

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearAuth();
          if (
            !window.location.pathname.startsWith('/auth/login') &&
            !window.location.pathname.startsWith('/auth/register')
          ) {
            const currentPath = window.location.pathname + window.location.search;
            const redirectParam = encodeURIComponent(currentPath);
            window.location.href = `/auth/login?redirect=${redirectParam}`;
          }
          return Promise.reject(error);
        }

        if (isRefreshing) {
          // If a refresh is already in progress, queue this request
          return new Promise<unknown>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              if (originalRequest.headers) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              }
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Call refresh endpoint with standalone axios to avoid interceptor loop
          const { data } = await axios.post<{ data: { user: any; tokens: { accessToken: string; refreshToken: string } } }>(
            `${BASE_URL}/auth/refresh`,
            { refreshToken },
            { withCredentials: true },
          );

          const { user, tokens } = data.data;
          setAuth(user, tokens);

          processQueue(null, tokens.accessToken);

          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
          }
          return apiClient(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          clearAuth();
          addToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
          if (
            !window.location.pathname.startsWith('/auth/login') &&
            !window.location.pathname.startsWith('/auth/register')
          ) {
            const currentPath = window.location.pathname + window.location.search;
            const redirectParam = encodeURIComponent(currentPath);
            window.location.href = `/auth/login?redirect=${redirectParam}`;
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      // Handle other non-401 errors
      if (status) {
        if (status === 403 && !isAuthRequest) {
          addToast(`Accès refusé : ${message}`, 'error');
        } else if (status >= 500) {
          addToast('Une erreur interne du serveur est survenue.', 'error');
        } else if (status === 400 && !isAuthRequest) {
          addToast(`Données invalides : ${message}`, 'warning');
        }
      }
    }
    return Promise.reject(error);
  },
);
