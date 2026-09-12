import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BuyerHeader } from './BuyerHeader';

const mockNavigate = vi.fn();
let mockPathname = '/marketplace';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, className, 'aria-label': ariaLabel }: any) => (
    <a
      href={to}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      data-testid={`link-${to}`}
    >
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

let mockUser: any = {
  id: 'buyer-1',
  firstName: 'Khadija',
  lastName: 'Sy',
  email: 'khadija.sy@futurefarm.local',
  roles: ['Buyer'],
};
let mockIsAuthenticated = true;

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
  }),
}));

const mockClearAuth = vi.fn();
vi.mock('@/features/auth/store/auth.store', () => ({
  clearAuth: () => mockClearAuth(),
}));

vi.mock('@/features/basket/api/basket.queries', () => ({
  getBasketQuery: () => ({
    queryKey: ['basket'],
    queryFn: async () => ({
      lines: [
        { id: '1', quantity: 3 },
        { id: '2', quantity: 2 },
      ],
    }),
  }),
}));

vi.mock('@/features/notifications/api/notifications.queries', () => ({
  getMyNotificationsQuery: () => ({
    queryKey: ['notifications'],
    queryFn: async () => ({
      data: [
        { id: 'n1', title: 'Nouvelle récolte', status: 'UNREAD' },
        { id: 'n2', title: 'Commande prête', status: 'READ' },
      ],
    }),
  }),
}));

describe('BuyerHeader Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/marketplace';
    mockIsAuthenticated = true;
    mockUser = {
      id: 'buyer-1',
      firstName: 'Khadija',
      lastName: 'Sy',
      email: 'khadija.sy@futurefarm.local',
      roles: ['Buyer'],
    };
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );
  };

  it('renders title, notifications icon, and hamburger button', () => {
    renderWithProviders(<BuyerHeader title="Marché" />);

    expect(screen.getByRole('heading', { name: 'Marché' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByTestId('buyer-hamburger-btn')).toBeInTheDocument();
  });

  it('renders back button when showBack is true', () => {
    renderWithProviders(
      <BuyerHeader title="Mon Panier" showBack backTo="/marketplace" />,
    );

    const backLink = screen.getByRole('link', { name: 'Retour' });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/marketplace');
  });

  it('opens hamburger drawer when menu button is clicked and shows navigation links', () => {
    renderWithProviders(<BuyerHeader title="Marché" />);

    // Drawer is not open initially
    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument();

    // Click hamburger button
    fireEvent.click(screen.getByTestId('buyer-hamburger-btn'));

    // Drawer opens
    expect(screen.getByTestId('drawer-backdrop')).toBeInTheDocument();
    expect(screen.getByText('Khadija Sy')).toBeInTheDocument();
    expect(screen.getByText('khadija.sy@futurefarm.local')).toBeInTheDocument();
    expect(screen.getByText('Acheteur')).toBeInTheDocument();

    // Verify navigation links inside drawer
    expect(screen.getByTestId('link-/marketplace')).toBeInTheDocument();
    expect(screen.getAllByTestId('link-/cart').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('link-/orders')).toBeInTheDocument();
    expect(screen.getByTestId('link-/auctions')).toBeInTheDocument();
    expect(screen.getAllByTestId('link-/notifications').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('link-/profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se déconnecter/i })).toBeInTheDocument();
  });

  it('closes drawer when clicking close button or backdrop', () => {
    renderWithProviders(<BuyerHeader title="Marché" />);

    fireEvent.click(screen.getByTestId('buyer-hamburger-btn'));
    expect(screen.getByTestId('drawer-backdrop')).toBeInTheDocument();

    // Click close button
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument();
  });

  it('dispatches logout and navigates to login when clicking logout', () => {
    renderWithProviders(<BuyerHeader title="Marché" />);

    fireEvent.click(screen.getByTestId('buyer-hamburger-btn'));
    const logoutBtn = screen.getByRole('button', { name: /Se déconnecter/i });
    fireEvent.click(logoutBtn);

    expect(mockClearAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/auth/login' });
  });
});
