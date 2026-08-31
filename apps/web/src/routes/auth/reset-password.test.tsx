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

import { ResetPasswordPage } from './reset-password';
import * as authQueries from '@/features/auth/api/auth.queries';

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

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders invalid/missing token warning when token is absent', () => {
    mockUseSearch.mockReturnValue({});

    renderWithClient(<ResetPasswordPage />);

    expect(
      screen.getByRole('heading', { name: /lien invalide ou expiré/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /demander un nouveau lien/i }),
    ).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('renders password reset form when token is present', () => {
    mockUseSearch.mockReturnValue({ token: 'valid-reset-token-123' });

    renderWithClient(<ResetPasswordPage />);

    expect(
      screen.getByRole('heading', { name: /nouveau mot de passe/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^nouveau mot de passe/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/confirmer le nouveau mot de passe/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /changer le mot de passe/i }),
    ).toBeInTheDocument();
  });

  it('shows error if password is less than 8 characters', async () => {
    mockUseSearch.mockReturnValue({ token: 'valid-token' });

    renderWithClient(<ResetPasswordPage />);

    const newPasswordInput = screen.getByLabelText(/^nouveau mot de passe/i);
    const confirmPasswordInput = screen.getByLabelText(
      /confirmer le nouveau mot de passe/i,
    );

    fireEvent.change(newPasswordInput, { target: { value: 'short' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });

    const submitBtn = screen.getByRole('button', {
      name: /changer le mot de passe/i,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/le mot de passe doit comporter au moins 8 caractères/i),
    ).toBeInTheDocument();
  });

  it('shows error if passwords do not match', async () => {
    mockUseSearch.mockReturnValue({ token: 'valid-token' });

    renderWithClient(<ResetPasswordPage />);

    const newPasswordInput = screen.getByLabelText(/^nouveau mot de passe/i);
    const confirmPasswordInput = screen.getByLabelText(
      /confirmer le nouveau mot de passe/i,
    );

    fireEvent.change(newPasswordInput, { target: { value: 'SecretPassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123' } });

    const submitBtn = screen.getByRole('button', {
      name: /changer le mot de passe/i,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/les mots de passe ne correspondent pas/i),
    ).toBeInTheDocument();
  });

  it('submits valid password and transitions to success state', async () => {
    mockUseSearch.mockReturnValue({ token: 'my-reset-token' });
    const mockMutationFn = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(authQueries, 'resetPasswordMutation').mockReturnValue({
      mutationKey: ['auth', 'resetPassword'] as const,
      mutationFn: mockMutationFn,
    });

    renderWithClient(<ResetPasswordPage />);

    const newPasswordInput = screen.getByLabelText(/^nouveau mot de passe/i);
    const confirmPasswordInput = screen.getByLabelText(
      /confirmer le nouveau mot de passe/i,
    );

    fireEvent.change(newPasswordInput, { target: { value: 'SecretPassword123!' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'SecretPassword123!' },
    });

    const submitBtn = screen.getByRole('button', {
      name: /changer le mot de passe/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledWith(
        {
          token: 'my-reset-token',
          newPassword: 'SecretPassword123!',
        },
        expect.anything(),
      );
      expect(
        screen.getByRole('heading', { name: /mot de passe mis à jour !/i }),
      ).toBeInTheDocument();
    });

    const loginBtn = screen.getByRole('button', { name: /se connecter/i });
    fireEvent.click(loginBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/auth/login' });
  });

  it('displays API error on server rejection', async () => {
    mockUseSearch.mockReturnValue({ token: 'expired-token' });
    const mockMutationFn = vi
      .fn()
      .mockRejectedValue(new Error('Invalid or expired reset token.'));
    vi.spyOn(authQueries, 'resetPasswordMutation').mockReturnValue({
      mutationKey: ['auth', 'resetPassword'] as const,
      mutationFn: mockMutationFn,
    });

    renderWithClient(<ResetPasswordPage />);

    const newPasswordInput = screen.getByLabelText(/^nouveau mot de passe/i);
    const confirmPasswordInput = screen.getByLabelText(
      /confirmer le nouveau mot de passe/i,
    );

    fireEvent.change(newPasswordInput, { target: { value: 'SecretPassword123!' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'SecretPassword123!' },
    });

    const submitBtn = screen.getByRole('button', {
      name: /changer le mot de passe/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or expired reset token/i),
      ).toBeInTheDocument();
    });
  });
});
