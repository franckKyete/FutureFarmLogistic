import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartPage } from './cart';
import { currencyStore } from '@/features/currency/store/currency.store';
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
  Link: ({ children, to, className, 'aria-label': ariaLabel }: any) => (
    <a href={to} className={className} aria-label={ariaLabel} data-testid="app-link">
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/cart' }),
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

const mockUpdateMutation = vi.fn();
const mockRemoveMutation = vi.fn();

let mockBasketData: BasketDto = {
  id: 'basket-1',
  buyerId: 'buyer-1',
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [],
};

vi.mock('@/features/basket/api/basket.queries', () => ({
  getBasketQuery: () => ({
    queryKey: ['basket'],
    queryFn: async () => mockBasketData,
  }),
  updateBasketLineMutation: (lineId: string) => ({
    mutationKey: ['basket', 'update', lineId],
    mutationFn: async (dto: any) => {
      mockUpdateMutation(lineId, dto);
      return { success: true };
    },
  }),
  removeBasketLineMutation: (lineId: string) => ({
    mutationKey: ['basket', 'remove', lineId],
    mutationFn: async () => {
      mockRemoveMutation(lineId);
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

describe('CartPage (/cart)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currencyStore.setState((prev) => ({
      ...prev,
      selectedCountry: 'SEN',
      selectedCurrency: 'EUR',
      currencies: [
        {
          code: 'EUR',
          name: 'Euro',
          symbol: '€',
          rateAgainstBase: 0.92,
          isBase: false,
          isActive: true,
          updatedAt: '',
        },
      ],
    }));
  });

  const expiringDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const freshDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  it('renders empty cart state when no lines exist', async () => {
    mockBasketData = {
      id: 'basket-1',
      buyerId: 'buyer-1',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [],
    };

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CartPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Votre panier est vide')).toBeDefined();
    expect(screen.getByText(/Explorez les récoltes fraîches/)).toBeDefined();
    expect(screen.getByText('Découvrir le marché')).toBeDefined();
  });

  it('groups items by producer and displays producer headers, product cards, and summary', async () => {
    mockBasketData = {
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
              description: 'Super tomates',
              category: ProductCategory.VEGETABLES,
              createdAt: '',
              updatedAt: '',
            },
            farmerProfileId: 'farmer-1',
            farmerProfile: {
              id: 'farmer-1',
              companyName: 'Ferme des Oliviers',
              address: 'Avignon, France',
              isCertified: true,
              avatarUrl: 'https://farm1.jpg',
            },
            harvestDate: '2026-09-01',
            expirationDate: expiringDate,
            quantityInStock: 50,
            stockMarge: 5,
            pricePerUnit: 4.5,
            currency: 'EUR',
            unit: HarvestUnit.KG,
            farmingMethods: 'Bio',
            photoUrls: ['https://tomato.jpg'],
            status: HarvestStatus.APPROVED,
            qualityScore: 98,
            createdAt: '',
            updatedAt: '',
          },
        },
        {
          id: 'line-2',
          basketId: 'basket-1',
          harvestId: 'harvest-2',
          quantity: 1,
          createdAt: new Date().toISOString(),
          harvest: {
            id: 'harvest-2',
            productId: 'prod-2',
            product: {
              id: 'prod-2',
              name: 'Fromage de Chèvre Frais',
              description: 'Chèvre frais artisanal',
              category: ProductCategory.DAIRY,
              createdAt: '',
              updatedAt: '',
            },
            farmerProfileId: 'farmer-2',
            farmerProfile: {
              id: 'farmer-2',
              companyName: 'Laiterie du Val',
              address: 'Annecy, France',
              isCertified: true,
              avatarUrl: 'https://farm2.jpg',
            },
            harvestDate: '2026-09-05',
            expirationDate: freshDate,
            quantityInStock: 20,
            stockMarge: 2,
            pricePerUnit: 5.2,
            currency: 'EUR',
            unit: HarvestUnit.PIECE,
            farmingMethods: 'Artisanal',
            photoUrls: ['https://cheese.jpg'],
            status: HarvestStatus.APPROVED,
            qualityScore: 94,
            createdAt: '',
            updatedAt: '',
          },
        },
      ],
    };

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CartPage />
      </QueryClientProvider>,
    );

    // Producer 1
    expect(await screen.findByText('Ferme des Oliviers')).toBeDefined();
    expect(screen.getByText('Avignon, France')).toBeDefined();
    expect(screen.getByText('Tomates Grappes Bio')).toBeDefined();
    expect(screen.getByText('Légumes')).toBeDefined();
    expect(screen.getByText(/Score IA: 98/)).toBeDefined();
    expect(screen.getByText('4,50 € / kg')).toBeDefined();
    expect(screen.getAllByText('9,00 €')).toHaveLength(2); // Card subtotal and Producer subtotal

    // Expiration warning on line 1 (expires in 2 days)
    expect(
      screen.getByText(/Ce produit expire dans 2 jours — commandez rapidement/),
    ).toBeDefined();

    // Producer 2
    expect(screen.getByText('Laiterie du Val')).toBeDefined();
    expect(screen.getByText('Annecy, France')).toBeDefined();
    expect(screen.getByText('Fromage de Chèvre Frais')).toBeDefined();
    expect(screen.getByText('Crèmerie')).toBeDefined();
    expect(screen.getByText(/Score IA: 94/)).toBeDefined();
    expect(screen.getByText('5,20 € / pce')).toBeDefined();
    expect(screen.getAllByText('5,20 €')).toHaveLength(2); // Card subtotal and Producer subtotal

    // Header counter
    expect(screen.getByText('2 articles de 2 producteurs')).toBeDefined();

    // Summary Card
    expect(screen.getByText('Récapitulatif')).toBeDefined();
    expect(screen.getByText('14,20 €')).toBeDefined(); // subtotal
    expect(screen.getByText('Procéder au paiement')).toBeDefined();
  });

  it('handles quantity increment, decrement, and removal', async () => {
    mockBasketData = {
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
              description: 'Super tomates',
              category: ProductCategory.VEGETABLES,
              createdAt: '',
              updatedAt: '',
            },
            farmerProfileId: 'farmer-1',
            farmerProfile: {
              id: 'farmer-1',
              companyName: 'Ferme des Oliviers',
              address: 'Avignon, France',
              isCertified: true,
            },
            harvestDate: '2026-09-01',
            expirationDate: freshDate,
            quantityInStock: 50,
            stockMarge: 5,
            pricePerUnit: 4.5,
            unit: HarvestUnit.KG,
            farmingMethods: 'Bio',
            photoUrls: ['https://tomato.jpg'],
            status: HarvestStatus.APPROVED,
            qualityScore: 98,
            createdAt: '',
            updatedAt: '',
          },
        },
      ],
    };

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CartPage />
      </QueryClientProvider>,
    );

    // Increase qty
    const plusBtn = await screen.findByLabelText('Augmenter la quantité');
    fireEvent.click(plusBtn);
    await waitFor(() => {
      expect(mockUpdateMutation).toHaveBeenCalledWith('line-1', { quantity: 3 });
    });

    // Decrease qty
    const minusBtn = screen.getByLabelText('Diminuer la quantité');
    fireEvent.click(minusBtn);
    await waitFor(() => {
      expect(mockUpdateMutation).toHaveBeenCalledWith('line-1', { quantity: 1 });
    });

    // Remove line
    const deleteBtn = screen.getByLabelText('Supprimer cet article');
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockRemoveMutation).toHaveBeenCalledWith('line-1');
    });
  });

  it('handles promo code application and navigation to checkout', async () => {
    mockBasketData = {
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
            farmerProfile: {
              id: 'farmer-1',
              companyName: 'Ferme des Oliviers',
              address: 'Avignon, France',
              isCertified: true,
            },
            harvestDate: '2026-09-01',
            expirationDate: freshDate,
            quantityInStock: 50,
            stockMarge: 5,
            pricePerUnit: 10,
            unit: HarvestUnit.KG,
            farmingMethods: 'Bio',
            photoUrls: [],
            status: HarvestStatus.APPROVED,
            qualityScore: 98,
            createdAt: '',
            updatedAt: '',
          },
        },
      ],
    };

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CartPage />
      </QueryClientProvider>,
    );

    // Verify order summary title is displayed
    expect(await screen.findByText('Récapitulatif')).toBeInTheDocument();

    // Click checkout CTA
    const checkoutBtn = screen.getByText('Procéder au paiement');
    fireEvent.click(checkoutBtn);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/checkout' });
  });
});
