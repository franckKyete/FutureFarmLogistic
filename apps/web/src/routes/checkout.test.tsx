import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckoutPage } from './checkout';
import {
  BasketDto,
  ProductCategory,
  HarvestUnit,
  HarvestStatus,
} from '@futurefarm/types';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    component: config.component,
  }),
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className} data-testid="app-link">
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/checkout' }),
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'buyer@futurefarm.com' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/features/notifications/api/notifications.queries', () => ({
  getMyNotificationsQuery: () => ({
    queryKey: ['notifications'],
    queryFn: async () => ({ data: [] }),
  }),
}));

vi.mock('@/features/auth/utils/auth-guard', () => ({
  requireAuth: vi.fn(),
}));

const mockCheckoutMutation = vi.fn();
const mockConfirmPaymentMutation = vi.fn();

const mockBasketData: BasketDto = {
  id: 'basket-1',
  buyerId: 'buyer-1',
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [
    {
      id: 'line-1',
      basketId: 'basket-1',
      harvestId: 'harvest-1',
      quantity: 2,
      createdAt: new Date().toISOString(),
      harvest: {
        id: 'harvest-1',
        productId: 'prod-1',
        product: {
          id: 'prod-1',
          name: 'Tomates Grappes Bio',
          description: '',
          category: ProductCategory.VEGETABLES,
          createdAt: '',
          updatedAt: '',
        },
        farmerProfileId: 'farmer-1',
        harvestDate: '2026-09-01',
        expirationDate: '2026-09-20',
        quantityInStock: 50,
        stockMarge: 5,
        pricePerUnit: 1500,
        unit: HarvestUnit.KG,
        farmingMethods: 'Bio',
        photoUrls: [],
        status: HarvestStatus.APPROVED,
        createdAt: '',
        updatedAt: '',
      },
    },
  ],
};

let mockCheckoutResponse: any = null;

vi.mock('@/features/basket/api/basket.queries', () => ({
  getBasketQuery: () => ({
    queryKey: ['basket'],
    queryFn: async () => mockBasketData,
  }),
  checkoutMutation: () => ({
    mutationKey: ['basket', 'checkout'],
    mutationFn: async (dto: any) => {
      mockCheckoutMutation(dto);
      return (
        mockCheckoutResponse || {
          order: {
            id: 'order-12345678',
            buyerId: 'buyer-1',
            totalAmount: 3000,
            status: 'AWAITING_CONFIRMATION',
            paymentStatus: 'PAID',
          },
        }
      );
    },
  }),
}));

vi.mock('@/features/orders/api/orders.queries', () => ({
  confirmPaymentMutation: () => ({
    mutationKey: ['orders', 'confirm-payment'],
    mutationFn: async (ref: string) => {
      mockConfirmPaymentMutation(ref);
      return { success: true };
    },
  }),
}));

const mockAddToast = vi.fn();
vi.mock('@/features/shared/store/toast.store', () => ({
  addToast: (msg: string, type: string) => mockAddToast(msg, type),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

describe('CheckoutPage (/checkout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockCheckoutResponse = null;
  });

  it('renders Step 1 (Livraison) matching the mockup with saved addresses and slot selector', async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>,
    );

    // Header & Stepper
    expect(await screen.findByText('Finaliser la commande')).toBeDefined();
    expect(screen.getByText('Livraison')).toBeDefined();
    expect(screen.getByText('Paiement')).toBeDefined();
    expect(screen.getByText('Confirmation')).toBeDefined();

    // Form inputs
    expect(screen.getByText('Adresse de livraison')).toBeDefined();
    expect(screen.getByDisplayValue('12 Rue des Agriculteurs, Dakar')).toBeDefined();
    expect(screen.getByText('Date de livraison')).toBeDefined();
    expect(screen.getByText('Créneau de livraison')).toBeDefined();
    expect(screen.getByText('Matin (08:00 - 12:00)')).toBeDefined();
    expect(screen.getByText('Après-midi')).toBeDefined();
    expect(screen.getByText('Soir')).toBeDefined();

    // Special instructions
    expect(screen.getByPlaceholderText('Ex: Code porte, étage, point de repère...')).toBeDefined();

    // Bottom summary bar & trust indicators
    expect(screen.getByText('TOTAL À PAYER')).toBeDefined();
    expect(screen.getByText('Livré sous 24h')).toBeDefined();
    expect(screen.getByText(/Paiement sécurisé/i)).toBeDefined();

    // CTA in sticky footer
    expect(screen.getByText('Continuer vers le paiement')).toBeDefined();
  });

  it('selects saved addresses and automatically saves new address on submit', async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>,
    );

    // Open saved addresses dropdown
    const savedBtn = await screen.findByText(/Adresses enregistrées/);
    fireEvent.click(savedBtn);

    // Click Dakar saved address
    const dakarOption = screen.getByText(/45 Avenue de la Paix, Dakar/);
    fireEvent.click(dakarOption);

    expect(screen.getByDisplayValue('45 Avenue de la Paix, Dakar')).toBeDefined();

    // Type a brand new address
    const input = screen.getByDisplayValue('45 Avenue de la Paix, Dakar');
    fireEvent.change(input, { target: { value: '99 Boulevard Circulaire, Lomé' } });

    // Click continue to payment in sticky bar
    const continueBtn = screen.getByTestId('continue-button');
    fireEvent.click(continueBtn);

    // Verifies address was automatically saved in localStorage
    const savedInStorage = JSON.parse(localStorage.getItem('futurefarm_saved_addresses') || '[]');
    expect(savedInStorage).toContain('99 Boulevard Circulaire, Lomé');

    // Transitions to Step 2: Paiement
    expect(await screen.findByText('Choisir le mode de paiement')).toBeDefined();
    expect(screen.getByText(/99 Boulevard Circulaire, Lomé/)).toBeDefined();
  });

  it('completes the self-hosted payment flow and displays the confirmation screen', async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>,
    );

    // Ensure basket and page are loaded
    await waitFor(() => {
      expect(screen.getByTestId('continue-button')).not.toBeDisabled();
    });

    // Move from Step 1 to Step 2
    const continueBtn = screen.getByTestId('continue-button');
    fireEvent.click(continueBtn);

    // On Step 2: Verify only Stripe and Mobile Money are present (Mode Test removed)
    expect(await screen.findByText('Choisir le mode de paiement')).toBeDefined();
    expect(screen.getByText('Carte bancaire (Stripe)')).toBeDefined();
    expect(screen.getByText('Mobile Money')).toBeDefined();
    expect(screen.queryByText(/Mode Test/i)).toBeNull();
    expect(screen.queryByText(/Simulation Immédiate/i)).toBeNull();

    const payBtn = screen.getByTestId('pay-button');
    fireEvent.click(payBtn);

    // Assert checkout was called with paymentMethod: 'stripe'
    await waitFor(() => {
      expect(mockCheckoutMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryAddress: expect.objectContaining({
            street: '12 Rue des Agriculteurs',
            city: 'Dakar',
          }),
          notes: expect.stringContaining('Date:'),
          paymentMethod: 'stripe',
        }),
      );
    });

    // Transitions to Step 3: Confirmation
    expect(await screen.findByText('Commande confirmée !')).toBeDefined();
    expect(screen.getByText('#order-12')).toBeDefined();
    expect(screen.getByText('Suivre ma commande')).toBeDefined();
  });

  it('selects Mobile Money and submits with paymentMethod: mobile_money', async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>,
    );

    // Go to step 2
    await screen.findByText('Finaliser la commande');
    await waitFor(() => {
      expect(screen.getByTestId('continue-button')).not.toBeDisabled();
    });
    const continueBtn = screen.getByTestId('continue-button');
    fireEvent.click(continueBtn);

    // Select Mobile Money
    const mobileMoneyOption = await screen.findByText('Mobile Money');
    fireEvent.click(mobileMoneyOption);

    // Verify PawaPay redirection banner and absence of phone/card inputs
    expect(screen.getByText('Paiement Mobile Money via PawaPay')).toBeDefined();
    expect(screen.getByText(/Paiement sécurisé par PawaPay \(Mobile Money\)/i)).toBeDefined();
    expect(screen.queryByPlaceholderText('+221 77 000 00 00')).toBeNull();
    expect(screen.queryByPlaceholderText('4242 4242 4242 4242')).toBeNull();

    // Submit
    const payBtn = screen.getByTestId('pay-button');
    expect(screen.getByText(/Payer avec Mobile Money/i)).toBeDefined();
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(mockCheckoutMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'mobile_money',
        }),
      );
    });
  });

  it('redirects to paymentUrl when returned by checkout API', async () => {
    const originalLocation = window.location;
    // @ts-ignore
    delete (window as any).location;
    (window as any).location = { href: '' };

    mockCheckoutResponse = {
      order: {
        id: 'order-12345678',
        buyerId: 'buyer-1',
        totalAmount: 3000,
        status: 'PENDING_PAYMENT',
      },
      paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
    };

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>,
    );

    // Go to step 2
    await screen.findByText('Finaliser la commande');
    await waitFor(() => {
      expect(screen.getByTestId('continue-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('continue-button'));

    // Click pay
    const payBtn = await screen.findByTestId('pay-button');
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/c/pay/cs_test_abc123');
    });

    (window as any).location = originalLocation;
  });
});
