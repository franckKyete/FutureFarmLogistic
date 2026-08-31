import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock TanStack Router before component imports
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => config,
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { ForgotPasswordPage } from './forgot-password';
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

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the forgot password form initially', () => {
    renderWithClient(<ForgotPasswordPage />);

    expect(
      screen.getByRole('heading', { name: /mot de passe oublié \?/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /envoyer le lien/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /retour à la page de connexion/i }),
    ).toHaveAttribute('href', '/auth/login');
  });

  it('submits email and transitions to success view on success', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(authQueries, 'forgotPasswordMutation').mockReturnValue({
      mutationKey: ['auth', 'forgotPassword'] as const,
      mutationFn: mockMutationFn,
    });

    renderWithClient(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/adresse email/i);
    fireEvent.change(emailInput, { target: { value: 'farmer@futurefarm.com' } });

    const submitBtn = screen.getByRole('button', { name: /envoyer le lien/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledWith(
        { email: 'farmer@futurefarm.com' },
        expect.anything(),
      );
      expect(
        screen.getByRole('heading', { name: /email envoyé !/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/farmer@futurefarm.com/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /renvoyer le lien/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /retour à la connexion/i }),
    ).toHaveAttribute('href', '/auth/login');
  });

  it('displays error message when request fails and allows retry', async () => {
    const mockMutationFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Erreur de serveur'))
      .mockResolvedValueOnce({ success: true });

    vi.spyOn(authQueries, 'forgotPasswordMutation').mockReturnValue({
      mutationKey: ['auth', 'forgotPassword'] as const,
      mutationFn: mockMutationFn,
    });

    renderWithClient(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/adresse email/i);
    fireEvent.change(emailInput, { target: { value: 'farmer@futurefarm.com' } });

    const submitBtn = screen.getByRole('button', { name: /envoyer le lien/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/erreur de serveur/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /réessayer l'envoi/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('heading', { name: /email envoyé !/i }),
      ).toBeInTheDocument();
    });
  });
});
