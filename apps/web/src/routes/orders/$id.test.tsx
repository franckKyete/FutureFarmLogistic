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

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => ({}),
    useParams: () => ({ id: 'order-9988' }),
  }),
  Link: ({ children, to, className, search, params, ...rest }: any) => {
    let path = to;
    if (params?.id) path = path.replace('$id', params.id);
    const query = search?.id ? `?id=${search.id}` : '';
    return (
      <a href={`${path}${query}`} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => mockNavigate,
  useRouterState: () => ({ matches: [{ routeId: '/orders/$id' }] }),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/features/auth/utils/auth-guard', () => ({
  requireAuth: vi.fn(),
}));

const mockApiClientGet = vi.fn().mockResolvedValue({
  data: new Blob(['%PDF-1.4 mock pdf data'], { type: 'application/pdf' }),
});

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
  },
}));

const mockOrderDetails: OrderDto = {
  id: 'order-9988-uuid-1234',
  buyerId: 'buyer-42',
  status: OrderStatus.CONFIRMED,
  paymentStatus: PaymentStatus.PAID,
  currency: 'XOF',
  exchangeRate: 600,
  totalAmount: 360000,
  cancellationFee: 0,
  deliveryAddress: {
    street: 'Avenue Cheikh Anta Diop',
    city: 'Saint-Louis',
    postalCode: '32000',
    country: 'Sénégal',
  },
  notes: 'Livraison prévue entre 08h et 12h',
  cancelledReason: null,
  auctionBidId: null,
  buyer: {
    id: 'buyer-42',
    firstName: 'Souleymane',
    lastName: 'Diallo',
    email: 'souleymane.diallo@example.com',
    phoneNumber: '+221 77 987 65 43',
  },
  delivery: {
    mode: 'Transporteur propre',
    driverName: 'Amadou Sow',
    driverPhone: '+221 77 123 45 67',
    vehiclePlate: 'DK-2024-SN',
    status: 'ASSIGNED',
  },
  lines: [
    {
      id: 'line-101',
      orderId: 'order-9988-uuid-1234',
      harvestId: 'harvest-202',
      farmerProfileId: 'farmer-50',
      quantity: 1200,
      unitPrice: 300,
      totalPrice: 360000,
      status: OrderLineStatus.CONFIRMED,
      rejectionReason: null,
      createdAt: '2026-08-20T10:00:00.000Z',
      farmerProfile: {
        id: 'farmer-50',
        userId: 'user-farmer-50',
        companyName: 'Ferme Bio de Niayes',
        address: 'Niayes, Sénégal',
        bio: 'Producteur maraîcher certifié biologique',
        isCertified: true,
        avatarUrl: 'https://example.com/farmer.jpg',
        user: {
          id: 'user-farmer-50',
          firstName: 'Moussa',
          lastName: 'Faye',
          email: 'moussa.faye@example.com',
          phoneNumber: '+221 77 111 22 33',
        },
      },
      harvest: {
        id: 'harvest-202',
        farmerProfileId: 'farmer-50',
        productId: 'prod-303',
        product: {
          id: 'prod-303',
          name: 'Tomates Grappe',
          category: 'VEGETABLES' as ProductCategory,
          description: 'Tomates fraîches récoltées à maturité',
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
        quantityInStock: 5000,
        stockMarge: 5,
        unit: HarvestUnit.KG,
        pricePerUnit: 300,
        harvestDate: '2026-08-20',
        expirationDate: '2026-09-20',
        farmingMethods: 'Agriculture Biologique',
        status: HarvestStatus.APPROVED,
        photoUrls: ['https://example.com/tomates.jpg'],
        createdAt: '2026-08-20',
        updatedAt: '2026-08-20',
      },
    },
  ],
  createdAt: '2026-08-20T14:32:00.000Z',
  updatedAt: '2026-08-20T14:35:00.000Z',
};

let currentMockOrder: OrderDto = mockOrderDetails;

const mockRetryPaymentFn = vi.fn();

vi.mock('@/features/orders/api/buyer-orders.queries', () => ({
  getOrderDetailsQuery: () => ({
    queryKey: ['orders', 'order-9988'],
    queryFn: async () => currentMockOrder,
  }),
  confirmPaymentMutation: () => ({
    mutationKey: ['orders', 'confirm-payment'],
    mutationFn: vi.fn(),
  }),
  retryPaymentMutation: () => ({
    mutationKey: ['orders', 'retry-payment'],
    mutationFn: mockRetryPaymentFn,
  }),
  cancelOrderMutation: () => ({
    mutationKey: ['orders', 'cancel'],
    mutationFn: vi.fn(),
  }),
}));

import { OrderDetailPage } from './$id';

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

describe('OrderDetailPage Redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockOrder = mockOrderDetails;
  });

  it('renders order reference header and status badge', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('Commande #ORD-ORDE')).toBeInTheDocument();
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Confirmée');
  });

  it('renders product details card with live data and FCFA prices', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('Tomates Grappe')).toBeInTheDocument();
    expect(screen.getByText('MARAÎCHAGE')).toBeInTheDocument();
    expect(screen.getByText(/1[\s\u202f]?200\s*kg/i)).toBeInTheDocument();
    expect(screen.getByText(/Prix unitaire:\s*300\s*FCFA\/kg/i)).toBeInTheDocument();
    expect(screen.getAllByText(/360[\s\u202f]?000\s*FCFA/i).length).toBeGreaterThan(0);
  });

  it('renders producer card with avatar, name linking to producer profile, location, and email/call buttons', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('PRODUCTEUR')).toBeInTheDocument();
    expect(screen.getByText('Ferme Bio de Niayes')).toBeInTheDocument();
    expect(screen.getByText('Niayes, Sénégal')).toBeInTheDocument();

    const profileLink = screen.getByTestId('producer-profile-link');
    expect(profileLink).toHaveAttribute('href', '/farmer/profile?id=farmer-50');

    const emailBtn = screen.getByTestId('producer-email-btn');
    expect(emailBtn).toHaveAttribute('href', 'mailto:moussa.faye@example.com');

    const phoneBtn = screen.getByTestId('producer-phone-btn');
    expect(phoneBtn).toHaveAttribute('href', 'tel:+221 77 111 22 33');
  });

  it('renders delivery card with carrier mode, driver name and phone call link', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('MODE DE LIVRAISON')).toBeInTheDocument();
    expect(screen.getByText('Transporteur propre')).toBeInTheDocument();
    expect(screen.getByText('Amadou Sow')).toBeInTheDocument();
    expect(screen.getByText('+221 77 123 45 67')).toBeInTheDocument();
    
    const callBtn = screen.getByLabelText('Appeler le transporteur');
    expect(callBtn).toHaveAttribute('href', 'tel:+221 77 123 45 67');
  });

  it('renders 4-step order tracking timeline with milestones', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('SUIVI DE COMMANDE')).toBeInTheDocument();
    expect(screen.getByText('Commande passée')).toBeInTheDocument();
    expect(screen.getByText('Paiement confirmé')).toBeInTheDocument();
    expect(screen.getByText('Préparation en cours')).toBeInTheDocument();
    expect(screen.getByText('Expédition')).toBeInTheDocument();
    
    // Tracking button is rendered when driver is assigned
    const trackBtn = screen.getByTestId('track-order-btn');
    expect(trackBtn).toBeInTheDocument();
    expect(trackBtn).toHaveAttribute('href', '/orders/order-9988-uuid-1234/tracking');
  });

  it('renders documents card with bon de commande and ensures no certificate link', async () => {
    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('DOCUMENTS')).toBeInTheDocument();
    expect(screen.getByText('Bon de commande PDF')).toBeInTheDocument();
    expect(screen.queryByText('Certificat qualité')).not.toBeInTheDocument();
  });

  it('calls backend API to download PDF when clicking Bon de commande PDF', async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    renderWithClient(<OrderDetailPage />);

    const downloadBtn = await screen.findByText('Bon de commande PDF');
    fireEvent.click(downloadBtn);

    expect(mockApiClientGet).toHaveBeenCalledWith(
      '/orders/order-9988-uuid-1234/pdf',
      { responseType: 'blob' },
    );
  });

  it('renders only one hero image even when order has multiple lines', async () => {
    currentMockOrder = {
      ...mockOrderDetails,
      lines: [
        mockOrderDetails.lines[0]!,
        {
          ...mockOrderDetails.lines[0]!,
          id: 'line-102',
          quantity: 16,
          unitPrice: 150,
          totalPrice: 2400,
        },
      ],
    };

    renderWithClient(<OrderDetailPage />);

    // In the product card, exactly one image is rendered even with multiple items
    const productCard = await screen.findByTestId('order-product-card');
    const images = productCard.querySelectorAll('img');
    expect(images.length).toBe(1);
    expect(screen.getByText('2 articles')).toBeInTheDocument();
  });

  it('does not display driver details when order is unconfirmed (pending payment)', async () => {
    currentMockOrder = {
      ...mockOrderDetails,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      delivery: {
        mode: 'Transporteur propre',
        driverName: null,
        driverPhone: null,
        status: 'PENDING',
      },
    };

    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('MODE DE LIVRAISON')).toBeInTheDocument();
    expect(
      screen.getByText('Attribution après paiement et confirmation'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Appeler le transporteur')).not.toBeInTheDocument();
    expect(screen.queryByText('Amadou Sow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('track-order-btn')).not.toBeInTheDocument();
  });

  it('displays payment processing notice and does not show confirm payment button when pending payment', async () => {
    currentMockOrder = {
      ...mockOrderDetails,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    };

    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByTestId('payment-processing-notice')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirmer le paiement/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /réessayer le paiement/i }),
    ).not.toBeInTheDocument();
  });

  it('displays payment failed alert and retry payment button when payment status is FAILED', async () => {
    currentMockOrder = {
      ...mockOrderDetails,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.FAILED,
    };
    mockRetryPaymentFn.mockResolvedValueOnce({
      order: currentMockOrder,
      paymentUrl: 'https://checkout.stripe.com/pay/session-9988',
    });

    renderWithClient(<OrderDetailPage />);

    expect(await screen.findByText('Échec du paiement')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /réessayer le paiement/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryPaymentFn).toHaveBeenCalledWith('order-9988-uuid-1234');
    });
  });
});
