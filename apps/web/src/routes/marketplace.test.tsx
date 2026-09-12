import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  HarvestDto,
  ProductCategory,
  HarvestUnit,
  HarvestStatus,
} from '@futurefarm/types';

const mockNavigate = vi.fn();
const mockUseSearch = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => mockUseSearch(),
  }),
  Link: ({ children, to, params, className }: any) => {
    let resolvedHref = to;
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        resolvedHref = resolvedHref.replace(`$${key}`, String(val));
      });
    }
    return (
      <a href={resolvedHref} className={className} data-testid="app-link">
        {children}
      </a>
    );
  },
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/marketplace' }),
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'buyer@futurefarm.com' },
    isAuthenticated: true,
  }),
}));

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

const mockHarvests: HarvestDto[] = [
  {
    id: 'harvest-uuid-1',
    farmerProfileId: 'farmer-1',
    productId: 'prod-1',
    product: {
      id: 'prod-1',
      name: 'Tomates Bio',
      category: 'VEGETABLES' as ProductCategory,
      description: 'Délicieuses tomates',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    quantityInStock: 100,
    stockMarge: 5,
    unit: HarvestUnit.KG,
    pricePerUnit: 2500,
    harvestDate: '2026-08-20T00:00:00.000Z',
    expirationDate: '2026-09-20T00:00:00.000Z',
    farmingMethods: 'Bio',
    status: HarvestStatus.APPROVED,
    qualityScore: 92,
    photoUrls: ['https://example.com/tomatoes.jpg'],
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'harvest-uuid-2',
    farmerProfileId: 'farmer-2',
    productId: 'prod-2',
    product: {
      id: 'prod-2',
      name: 'Pommes Gala',
      category: 'FRUITS' as ProductCategory,
      description: 'Pommes fraîches',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    quantityInStock: 50,
    stockMarge: 2,
    unit: HarvestUnit.KG,
    pricePerUnit: 3000,
    harvestDate: '2026-08-22T00:00:00.000Z',
    expirationDate: '2026-09-22T00:00:00.000Z',
    farmingMethods: 'Conventionnel',
    status: HarvestStatus.APPROVED,
    qualityScore: 85,
    photoUrls: [],
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  },
];

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/harvests') {
        return Promise.resolve({
          data: {
            data: {
              data: mockHarvests,
              meta: { total: 2, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

import { MarketplacePage } from './marketplace';

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

describe('MarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders harvest items wrapped in links pointing to /harvests/$id', async () => {
    renderWithClient(<MarketplacePage />);

    await waitFor(() => {
      expect(screen.getByText('Tomates Bio')).toBeInTheDocument();
      expect(screen.getByText('Pommes Gala')).toBeInTheDocument();
    });

    const links = screen.getAllByTestId('app-link').filter((el) =>
      el.getAttribute('href')?.startsWith('/harvests/'),
    );
    expect(links).toHaveLength(2);

    expect(links[0]).toHaveAttribute('href', '/harvests/harvest-uuid-1');
    expect(links[1]).toHaveAttribute('href', '/harvests/harvest-uuid-2');
  });

  it('displays pricing, stock, and quality score in harvest card', async () => {
    renderWithClient(<MarketplacePage />);

    await waitFor(() => {
      expect(screen.getByText('Tomates Bio')).toBeInTheDocument();
    });

    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Stock: 100kg')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('2,500') || content.includes('2 500')),
    ).toBeInTheDocument();
  });

  it('filters harvest items by category and search query', async () => {
    renderWithClient(<MarketplacePage />);

    await waitFor(() => {
      expect(screen.getByText('Tomates Bio')).toBeInTheDocument();
      expect(screen.getByText('Pommes Gala')).toBeInTheDocument();
    });

    // Filter by Fruits
    const fruitBtn = screen.getByRole('button', { name: 'Fruits' });
    fireEvent.click(fruitBtn);

    await waitFor(() => {
      expect(screen.queryByText('Tomates Bio')).not.toBeInTheDocument();
      expect(screen.getByText('Pommes Gala')).toBeInTheDocument();
    });

    // Reset filter to All
    const allBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(screen.getByText('Tomates Bio')).toBeInTheDocument();
      expect(screen.getByText('Pommes Gala')).toBeInTheDocument();
    });

    // Search query
    const searchInput = screen.getByPlaceholderText('Search products, farms...');
    fireEvent.change(searchInput, { target: { value: 'Tomates' } });

    await waitFor(() => {
      expect(screen.getByText('Tomates Bio')).toBeInTheDocument();
      expect(screen.queryByText('Pommes Gala')).not.toBeInTheDocument();
    });
  });
});
