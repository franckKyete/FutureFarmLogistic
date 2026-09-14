import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  OrderDto,
} from '@futurefarm/types';
import { FarmerOrderDetailPage } from './$id';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useParams: () => ({ id: 'order-11d77136-uuid-5678' }),
  }),
  Link: ({ children, to, className, ...rest }: any) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/farmer/store/farmer-layout.store', () => ({
  useFarmerLayout: vi.fn(),
}));

const mockOrderAwaitingConfirmation: OrderDto = {
  id: '11d77136-1234-5678-90ab-cdef12345678',
  buyerId: 'buyer-tester-id',
  status: OrderStatus.AWAITING_CONFIRMATION,
  paymentStatus: PaymentStatus.PAID,
  currency: 'CDF',
  exchangeRate: 2800,
  totalAmount: 150000,
  cancellationFee: 0,
  deliveryAddress: {
    city: 'Lubumbashi',
    country: 'COD',
    phoneNumber: '+243 81 234 56 78',
    recipientName: 'Buyer Tester',
  },
  notes: 'Date: 2026-09-15 | Créneau: Matin (08:00 - 12:00)',
  cancelledReason: null,
  auctionBidId: null,
  createdAt: '2026-09-14T06:00:00.000Z',
  updatedAt: '2026-09-14T06:00:00.000Z',
  buyer: {
    id: 'buyer-tester-id',
    firstName: 'Buyer',
    lastName: 'Tester',
    email: 'buyer@tester.cd',
    phoneNumber: '+243 81 234 56 78',
  },
  delivery: {
    mode: 'Transporteur propre',
    driverName: 'Michel Kalala',
    driverPhone: '+243 99 876 54 32',
    vehiclePlate: 'LSH-4421-CD',
    vehicleType: 'VAN',
    status: 'PLANNED',
  },
  lines: [
    {
      id: 'line-farmer-1',
      orderId: '11d77136-1234-5678-90ab-cdef12345678',
      harvestId: 'harvest-tomatoes-1',
      farmerProfileId: 'farmer-profile-me',
      quantity: 50,
      unitPrice: 3000,
      totalPrice: 150000,
      currency: 'CDF',
      status: OrderLineStatus.PENDING,
      rejectionReason: null,
      createdAt: '2026-09-14T06:00:00.000Z',
      harvest: {
        id: 'harvest-tomatoes-1',
        unit: 'kg',
        photoUrls: ['https://example.com/tomates.jpg'],
        product: {
          id: 'prod-tomates',
          name: 'Tomates fraîches',
          category: 'VEGETABLES',
        },
      } as any,
    },
  ],
};

let currentOrderData: any = mockOrderAwaitingConfirmation;

const mockConfirmMutation = vi.fn().mockImplementation(async () => {
  currentOrderData = {
    ...currentOrderData,
    status: OrderStatus.CONFIRMED,
    lines: [
      {
        ...currentOrderData.lines[0],
        status: OrderLineStatus.CONFIRMED,
      },
    ],
  };
  return currentOrderData;
});

const mockRejectMutation = vi.fn().mockImplementation(async () => {
  currentOrderData = {
    ...currentOrderData,
    status: OrderStatus.CANCELLED,
    lines: [
      {
        ...currentOrderData.lines[0],
        status: OrderLineStatus.REJECTED,
      },
    ],
  };
  return currentOrderData;
});

vi.mock('@/features/orders/api/orders.queries', () => ({
  getOrderDetailsQuery: () => ({
    queryKey: ['orders', 'order-11d77136-uuid-5678'],
    queryFn: () => Promise.resolve(currentOrderData),
  }),
  confirmOrderLineMutation: () => ({
    mutationFn: () => mockConfirmMutation(),
  }),
  rejectOrderLineMutation: () => ({
    mutationFn: () => mockRejectMutation(),
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

describe('FarmerOrderDetailPage (/farmer/orders/$id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOrderData = JSON.parse(JSON.stringify(mockOrderAwaitingConfirmation));
  });

  it('renders driver card on farmer page even when order is awaiting confirmation', async () => {
    renderWithClient(<FarmerOrderDetailPage />);

    expect(await screen.findByText('Buyer Tester')).toBeInTheDocument();
    expect(screen.getByTestId('farmer-driver-card')).toBeInTheDocument();
    expect(screen.getByText('Michel Kalala')).toBeInTheDocument();
    expect(screen.getByText(/LSH-4421-CD/i)).toBeInTheDocument();

    const phoneBtn = screen.getByTestId('farmer-driver-phone-btn');
    expect(phoneBtn).toBeInTheDocument();
    expect(phoneBtn).toHaveAttribute('href', 'tel:+243 99 876 54 32');
  });

  it('renders fallback when no driver is assigned yet', async () => {
    currentOrderData = {
      ...mockOrderAwaitingConfirmation,
      delivery: {
        ...mockOrderAwaitingConfirmation.delivery,
        driverName: null,
        driverPhone: null,
      },
    };

    renderWithClient(<FarmerOrderDetailPage />);

    expect(await screen.findByText(/Chauffeur en cours d'attribution/i)).toBeInTheDocument();
    expect(screen.queryByTestId('farmer-driver-card')).not.toBeInTheDocument();
  });

  it('displays confirm and reject buttons while order line is pending', async () => {
    renderWithClient(<FarmerOrderDetailPage />);

    expect(await screen.findByText('Confirmer le lot')).toBeInTheDocument();
    expect(screen.getByText('Rejeter la commande')).toBeInTheDocument();
  });

  it('once confirmed, hides the confirm button and displays "Prêt pour la collecte"', async () => {
    renderWithClient(<FarmerOrderDetailPage />);

    const confirmBtn = await screen.findByText('Confirmer le lot');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockConfirmMutation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('Confirmer le lot')).not.toBeInTheDocument();
      expect(screen.getByTestId('farmer-ready-pickup-indicator')).toHaveTextContent(/Prêt pour la collecte/i);
    });
  });
});
