import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  OrderDto,
  HarvestUnit,
  HarvestStatus,
  ProductCategory,
} from '@futurefarm/types';

const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => mockSearch,
    useParams: () => ({ id: 'order-123' }),
  }),
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/orders' }),
  useRouterState: () => ({ matches: [{ routeId: '/orders/$id' }] }),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/features/auth/utils/auth-guard', () => ({
  requireAuth: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@/features/shared/store/toast.store', () => ({
  addToast: (msg: string, type: string) => mockToast(msg, type),
}));

const mockConfirmPaymentFn = vi.fn();
const mockRetryPaymentFn = vi.fn();
const mockCancelOrderFn = vi.fn();

const mockOrder: OrderDto = {
  id: 'order-123',
  buyerId: 'buyer-1',
  status: OrderStatus.PENDING_PAYMENT,
  paymentStatus: PaymentStatus.PENDING,
  totalAmount: 15000,
  cancellationFee: 0,
  deliveryAddress: {
    street: '123 Rue de la Ferme',
    city: 'Tunis',
    postalCode: '1000',
    country: 'Tunisie',
  },
  notes: 'Livrer le matin',
  cancelledReason: null,
  auctionBidId: null,
  lines: [
    {
      id: 'line-1',
      orderId: 'order-123',
      harvestId: 'h-1',
      farmerProfileId: 'f-1',
      quantity: 5,
      unitPrice: 3000,
      totalPrice: 15000,
      status: OrderLineStatus.PENDING,
      rejectionReason: null,
      createdAt: '2026-08-20T10:00:00.000Z',
      harvest: {
        id: 'h-1',
        farmerProfileId: 'f-1',
        productId: 'p-1',
        product: {
          id: 'p-1',
          name: 'Tomates Bio',
          category: 'VEGETABLES' as ProductCategory,
          description: '',
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
        quantityInStock: 100,
        stockMarge: 5,
        unit: HarvestUnit.KG,
        pricePerUnit: 3000,
        harvestDate: '2026-08-20',
        expirationDate: '2026-09-20',
        farmingMethods: 'Bio',
        status: HarvestStatus.APPROVED,
        photoUrls: [],
        createdAt: '2026-08-20',
        updatedAt: '2026-08-20',
      },
    },
  ],
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
};

vi.mock('@/features/basket/api/basket.queries', () => ({
  getBasketQuery: () => ({
    queryKey: ['basket'],
    queryFn: async () => ({ id: 'b1', lines: [] }),
  }),
}));

vi.mock('@/features/notifications/api/notifications.queries', () => ({
  getMyNotificationsQuery: () => ({
    queryKey: ['notifications'],
    queryFn: async () => ({ data: [] }),
  }),
}));

vi.mock('@/features/orders/api/buyer-orders.queries', () => ({
  getMyOrdersQuery: () => ({
    queryKey: ['orders', 'my'],
    queryFn: async () => [mockOrder],
  }),
  getOrderDetailsQuery: (id: string) => ({
    queryKey: ['orders', id],
    queryFn: async () => mockOrder,
  }),
  confirmPaymentMutation: () => ({
    mutationKey: ['orders', 'confirm-payment'],
    mutationFn: mockConfirmPaymentFn,
  }),
  retryPaymentMutation: () => ({
    mutationKey: ['orders', 'retry-payment'],
    mutationFn: mockRetryPaymentFn,
  }),
  cancelOrderMutation: () => ({
    mutationKey: ['orders', 'cancel'],
    mutationFn: mockCancelOrderFn,
  }),
}));

import { OrdersListPage } from './index';
import { OrderDetailPage } from './$id';

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

describe('Automated Stripe Payment Confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = {};
    mockConfirmPaymentFn.mockResolvedValue({
      ...mockOrder,
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
    });
  });

  describe('OrdersListPage (/orders)', () => {
    it('renders orders list normally without triggering confirmation when no session_id is present', async () => {
      mockSearch = {};
      renderWithClient(<OrdersListPage />);

      await waitFor(() => {
        expect(screen.getByText(/Réf : order-12/i)).toBeInTheDocument();
      });

      expect(mockConfirmPaymentFn).not.toHaveBeenCalled();
    });

    it('cleans redirect search parameters without triggering eager payment confirmation when returning from gateway with session_id', async () => {
      mockSearch = { session_id: 'cs_test_session_123', order_id: 'order-123' };
      renderWithClient(<OrdersListPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/orders',
          replace: true,
          search: {},
        });
      });

      expect(mockConfirmPaymentFn).not.toHaveBeenCalled();
    });
  });

  describe('OrderDetailPage (/orders/$id)', () => {
    it('displays awaiting webhook banner and does not eagerly confirm payment when loaded with session_id param', async () => {
      mockSearch = { session_id: 'cs_test_session_456' };
      renderWithClient(<OrderDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('order-awaiting-webhook-banner')).toBeInTheDocument();
      });

      expect(mockConfirmPaymentFn).not.toHaveBeenCalled();
    });

    it('does not display manual confirm payment button while payment is pending processing by provider', async () => {
      mockSearch = {};
      renderWithClient(<OrderDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('payment-processing-notice')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /confirmer le paiement/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /réessayer le paiement/i }),
      ).not.toBeInTheDocument();
    });

    it('displays retry payment button when payment has failed and triggers retryPayment mutation', async () => {
      mockSearch = { payment_failed: 'true' };
      mockRetryPaymentFn.mockResolvedValueOnce({
        order: mockOrder,
        paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_retry',
      });

      renderWithClient(<OrderDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Échec du paiement')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /réessayer le paiement/i }),
        ).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /réessayer le paiement/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(mockRetryPaymentFn).toHaveBeenCalledWith('order-123');
      });
    });
  });
});
