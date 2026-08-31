import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNavigate = vi.fn();
const mockUseSearch = vi.fn();

// Mock TanStack Router before component imports
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => mockUseSearch(),
  }),
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/auth/store/auth.store', () => ({
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  getAccessToken: vi.fn(),
  useAuthStore: vi.fn(),
}));

import { LoginPage } from './login';
import * as authQueries from '@/features/auth/api/auth.queries';
import * as authStore from '@/features/auth/store/auth.store';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearch.mockReturnValue({});
  });

  it('renders login form with functional links and without dead hrefs', () => {
    renderWithClient(<LoginPage />);

    expect(screen.getByRole('heading', { name: /bienvenue/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe/i)).toBeInTheDocument();

    const forgotLink = screen.getByRole('link', { name: /mot de passe oublié \?/i });
    expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password');

    const registerLink = screen.getByRole('link', { name: /créer un compte/i });
    expect(registerLink).toHaveAttribute('href', '/auth/register');

    // Ensure no inert links with href="#" remain
    const allLinks = screen.getAllByRole('link');
    allLinks.forEach((link) => {
      expect(link.getAttribute('href')).not.toBe('#');
    });
  });

  it('performs standard login when 2FA is not required', async () => {
    const mockUser = {
      id: 'u1',
      email: 'farmer@futurefarm.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      permissions: [],
      roles: ['Farmer'],
    };
    const mockTokens = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    };

    const mockLoginFn = vi.fn().mockResolvedValue({
      require2fa: false,
      user: mockUser,
      tokens: mockTokens,
    });

    vi.spyOn(authQueries, 'loginMutation').mockReturnValue({
      mutationKey: ['auth', 'login'] as const,
      mutationFn: mockLoginFn,
    });

    renderWithClient(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'farmer@futurefarm.com' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe/i), {
      target: { value: 'Secret1234' },
    });

    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(mockLoginFn).toHaveBeenCalledWith(
        {
          email: 'farmer@futurefarm.com',
          password: 'Secret1234',
        },
        expect.anything(),
      );
      expect(authStore.setAuth).toHaveBeenCalledWith(mockUser, mockTokens);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('switches to 2FA verification when backend responds with require2fa', async () => {
    const mockLoginFn = vi.fn().mockResolvedValue({
      require2fa: true,
      tempToken: 'temp-jwt-token-xyz',
    });

    const mockUser = {
      id: 'u2',
      email: 'admin@futurefarm.com',
      firstName: 'Admin',
      lastName: 'User',
      permissions: [],
      roles: ['Admin'],
    };
    const mockTokens = {
      accessToken: 'jwt-access-token',
      refreshToken: 'jwt-refresh-token',
    };

    const mock2faFn = vi.fn().mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    vi.spyOn(authQueries, 'loginMutation').mockReturnValue({
      mutationKey: ['auth', 'login'] as const,
      mutationFn: mockLoginFn,
    });

    vi.spyOn(authQueries, 'authenticate2faMutation').mockReturnValue({
      mutationKey: ['auth', 'authenticate2fa'] as const,
      mutationFn: mock2faFn,
    });

    renderWithClient(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'admin@futurefarm.com' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe/i), {
      target: { value: 'AdminPassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    // 2FA challenge screen appears
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /authentification à deux facteurs/i,
        }),
      ).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/code de sécurité/i);
    fireEvent.change(codeInput, { target: { value: '654321' } });

    const verifyBtn = screen.getByRole('button', { name: /valider le code/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(mock2faFn).toHaveBeenCalledWith(
        {
          tempToken: 'temp-jwt-token-xyz',
          code: '654321',
        },
        expect.anything(),
      );
      expect(authStore.setAuth).toHaveBeenCalledWith(mockUser, mockTokens);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('allows canceling 2FA screen back to standard login form', async () => {
    const mockLoginFn = vi.fn().mockResolvedValue({
      require2fa: true,
      tempToken: 'temp-jwt-token-xyz',
    });

    vi.spyOn(authQueries, 'loginMutation').mockReturnValue({
      mutationKey: ['auth', 'login'] as const,
      mutationFn: mockLoginFn,
    });

    renderWithClient(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'admin@futurefarm.com' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe/i), {
      target: { value: 'AdminPassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /authentification à deux facteurs/i,
        }),
      ).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', {
      name: /annuler et revenir/i,
    });
    fireEvent.click(cancelBtn);

    expect(screen.getByRole('heading', { name: /bienvenue/i })).toBeInTheDocument();
  });
});
