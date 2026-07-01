import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';

import type { AuthUser, AuthTokens } from '@futurefarm/types';

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
};

// Rehydrate from localStorage on init
function loadPersistedAuth(): AuthState {
  try {
    const raw = localStorage.getItem('futurefarm:auth');
    if (!raw) {
      return initialState;
    }
    const parsed = JSON.parse(raw) as AuthState;
    return { ...parsed, isAuthenticated: !!parsed.tokens?.accessToken };
  } catch {
    return initialState;
  }
}

export const authStore = new Store<AuthState>(initialState);
authStore.setState(() => loadPersistedAuth());

// ---- Actions ----

export function useAuthStore<T>(selector: (state: AuthState) => T) {
  return useStore(authStore, selector);
}

export function setAuth(user: AuthUser, tokens: AuthTokens) {
  authStore.setState(() => ({ user, tokens, isAuthenticated: true }));
  localStorage.setItem('futurefarm:auth', JSON.stringify({ user, tokens, isAuthenticated: true }));
}

export function clearAuth() {
  authStore.setState(() => initialState);
  localStorage.removeItem('futurefarm:auth');
}

export function getAccessToken(): string | null {
  return authStore.state.tokens?.accessToken ?? null;
}
