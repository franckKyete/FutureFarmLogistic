import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
import { OrderTrackingPage } from './tracking';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useParams: () => ({ id: 'order-9988-uuid-1234' }),
  }),
  Link: ({ children, to, className, params, ...rest }: any) => {
    const path = params?.id ? to.replace('$id', params.id) : to;
    return (
      <a href={path} className={className} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/auth/utils/auth-guard', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'buyer-42',
      firstName: 'Souleymane',
      lastName: 'Diallo',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
    isAuthenticated: true,
  }),
}));

vi.mock('@/features/shared/components/DeliveryMap', () => ({
  DeliveryMap: ({ driverName }: any) => (
    <div data-testid="delivery-map">Mock Delivery Map for {driverName}</div>
  ),
}));

vi.mock('@/features/shared/hooks/useDeliveryMap', () => ({
  useDeliveryMap: () => ({
    location: { lat: 14.755, lon: -17.394, heading: 45, speedKmh: 42, recordedAt: '2026-09-10T10:00:00Z' },
    isConnected: true,
  }),
}));

const mockAddToast = vi.fn();
vi.mock('@/features/shared/store/toast.store', () => ({
  addToast: (...args: any[]) => mockAddToast(...args),
}));

const mockOrder: OrderDto = {
  id: 'order-9988-uuid-1234',
  buyerId: 'buyer-42',
  status: OrderStatus.SHIPPED,
  paymentStatus: PaymentStatus.PAID,
  totalAmount: 360000,
  cancellationFee: 0,
  deliveryAddress: {
    street: 'Avenue Cheikh Anta Diop',
    city: 'Dakar',
    postalCode: '10000',
    country: 'Sénégal',
  },
  notes: '',
  cancelledReason: null,
  auctionBidId: null,
  buyer: {
    id: 'buyer-42',
    firstName: 'Souleymane',
    lastName: 'Diallo',
    email: 'souleymane.diallo@example.com',
  },
  delivery: {
    mode: 'Transporteur propre',
    driverName: 'Amadou K.',
    driverPhone: '+221 77 123 45 67',
    status: 'IN_TRANSIT',
  },
  lines: [
    {
      id: 'line-1',
      orderId: 'order-9988-uuid-1234',
      harvestId: 'harvest-202',
      farmerProfileId: 'farmer-50',
      quantity: 1200,
      unitPrice: 300,
      totalPrice: 360000,
      status: OrderLineStatus.SHIPPED,
      rejectionReason: null,
      createdAt: '2026-09-10T08:00:00.000Z',
      harvest: {
        id: 'harvest-202',
        farmerProfileId: 'farmer-50',
        productId: 'prod-303',
        product: {
          id: 'prod-303',
          name: 'Tomates Grappe',
          category: 'VEGETABLES' as ProductCategory,
          description: 'Tomates fraîches',
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
        quantityInStock: 5000,
        stockMarge: 5,
        unit: HarvestUnit.KG,
        pricePerUnit: 300,
        harvestDate: '2026-09-10',
        expirationDate: '2026-09-30',
        farmingMethods: 'Agriculture Biologique',
        status: HarvestStatus.APPROVED,
        photoUrls: ['https://example.com/tomates.jpg'],
        createdAt: '2026-09-10',
        updatedAt: '2026-09-10',
      },
    },
  ],
  createdAt: '2026-09-10T09:12:00.000Z',
  updatedAt: '2026-09-10T10:45:00.000Z',
};

vi.mock('@/features/orders/api/buyer-orders.queries', () => ({
  getOrderDetailsQuery: () => ({
    queryKey: ['orders', 'order-9988-uuid-1234'],
    queryFn: async () => mockOrder,
  }),
}));

vi.mock('@/features/admin/api/logistics.queries', () => ({
  useDeliveryRuns: () => ({
    data: [
      {
        id: 'run-101',
        driver: {
          id: 'driver-1',
          firstName: 'Amadou',
          lastName: 'Kane',
          phoneNumber: '+221 77 123 45 67',
          avatarUrl: 'https://example.com/amadou.jpg',
        },
        stops: [
          {
            id: 'stop-1',
            orderLineId: 'line-1',
            type: 'DELIVERY',
            status: 'IN_TRANSIT',
            address: { lat: 14.7167, lon: -17.4677, city: 'Dakar' },
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('OrderTrackingPage (/orders/$id/tracking)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders top header with Future Farm branding, back link and notification icon', async () => {
    renderWithClient(<OrderTrackingPage />);

    expect(
      await screen.findByLabelText('Retour aux détails de la commande'),
    ).toHaveAttribute('href', '/orders/order-9988-uuid-1234');
    expect(screen.getByText('Future Farm')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('renders estimated arrival card with order number and product summary', async () => {
    renderWithClient(<OrderTrackingPage />);

    expect(await screen.findByTestId('estimated-arrival-card')).toBeInTheDocument();
    expect(screen.getByText('SUIVI DE LIVRAISON')).toBeInTheDocument();
    expect(screen.getByText('N° Commande')).toBeInTheDocument();
    expect(screen.getByText('#ORD-ORDER-99')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
    expect(screen.getByText(/Tomates Grappe/i)).toBeInTheDocument();
  });

  it('renders driver info card with driver name and phone call button', async () => {
    renderWithClient(<OrderTrackingPage />);

    const driverCard = await screen.findByTestId('driver-info-card');
    expect(driverCard).toBeInTheDocument();
    expect(within(driverCard).getByText('Amadou K.')).toBeInTheDocument();

    const callBtn = screen.getByTestId('driver-phone-btn');
    expect(callBtn).toBeInTheDocument();
    expect(callBtn).toHaveAttribute('href', 'tel:+221 77 123 45 67');
  });

  it('renders order progress vertical timeline stepper with real lifecycle steps', async () => {
    renderWithClient(<OrderTrackingPage />);

    expect(await screen.findByTestId('order-progress-card')).toBeInTheDocument();
    expect(screen.getByText('Progression de la livraison')).toBeInTheDocument();
    expect(screen.getByText('Commande validée')).toBeInTheDocument();
    expect(screen.getByText('Collecte & Préparation')).toBeInTheDocument();
    expect(screen.getByText('Acheminement')).toBeInTheDocument();
    expect(screen.getByText('Livraison finale')).toBeInTheDocument();
  });

  it('renders contact driver and report issue action buttons', async () => {
    renderWithClient(<OrderTrackingPage />);

    const contactBtn = await screen.findByTestId('contact-driver-btn');
    expect(contactBtn).toBeInTheDocument();
    expect(contactBtn).toHaveAttribute('href', 'tel:+221 77 123 45 67');

    const reportBtn = screen.getByTestId('report-issue-btn');
    expect(reportBtn).toBeInTheDocument();
    fireEvent.click(reportBtn);
    expect(mockAddToast).toHaveBeenCalledWith(
      'Signalement transmis au support logistique.',
      'info',
    );
  });

  it('does not render bottom navigation bar on buyer tracking view', async () => {
    renderWithClient(<OrderTrackingPage />);

    await screen.findByTestId('estimated-arrival-card');
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.queryByText('Products')).toBeNull();
    expect(screen.queryByText('Auctions')).toBeNull();
  });
});
