import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  HarvestDto,
  ProductCategory,
  HarvestUnit,
  HarvestStatus,
  FarmerProfileDto,
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
      <a href={resolvedHref} className={className}>
        {children}
      </a>
    );
  },
  useNavigate: () => mockNavigate,
}));

let mockCurrentUser: any = {
  id: 'buyer-user-1',
  firstName: 'Buyer',
  lastName: 'Tester',
  email: 'buyer@futurefarm.sn',
  roles: ['Buyer'],
};

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: true,
  }),
}));

const mockPublicFarmerProfile: FarmerProfileDto & { user?: any } = {
  id: 'farmer-50',
  userId: 'user-farmer-50',
  companyName: 'Verdant Valley Estates',
  address: 'Niayes, Sénégal',
  bio: 'Premium Organic Soy & Corn Specialist since 2018. Focused on sustainable yield and high-precision logistics.',
  isCertified: true,
  avatarUrl: 'https://example.com/verdant.jpg',
  user: {
    id: 'user-farmer-50',
    firstName: 'Amadou',
    lastName: 'Ba',
    email: 'amadou.ba@example.com',
    phoneNumber: '+221 77 000 11 22',
  },
};

const mockPublicHarvests: HarvestDto[] = [
  {
    id: 'harvest-001',
    farmerProfileId: 'farmer-50',
    productId: 'p-1',
    product: {
      id: 'p-1',
      name: 'Premium Soybeans',
      category: 'LEGUMES' as ProductCategory,
      description: 'Légumineuses bio',
      createdAt: '2026-08-01',
      updatedAt: '2026-08-01',
    },
    quantityInStock: 4200,
    stockMarge: 5,
    unit: HarvestUnit.KG,
    pricePerUnit: 500,
    qualityScore: 9.2,
    farmingMethods: 'Agriculture Biologique',
    status: HarvestStatus.APPROVED,
    harvestDate: '2026-10-01',
    expirationDate: '2027-04-01',
    photoUrls: ['https://example.com/soybeans.jpg'],
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  },
  {
    id: 'harvest-002',
    farmerProfileId: 'farmer-50',
    productId: 'p-2',
    product: {
      id: 'p-2',
      name: 'Yellow Dent Corn',
      category: 'CEREALS' as ProductCategory,
      description: 'Céréales bio',
      createdAt: '2026-08-01',
      updatedAt: '2026-08-01',
    },
    quantityInStock: 12000,
    stockMarge: 5,
    unit: HarvestUnit.KG,
    pricePerUnit: 250,
    qualityScore: 8.8,
    farmingMethods: 'Agriculture Biologique',
    status: HarvestStatus.APPROVED,
    harvestDate: '2026-09-01',
    expirationDate: '2027-03-01',
    photoUrls: ['https://example.com/corn.jpg'],
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  },
];

vi.mock('@/features/profile/api/profile.queries', () => ({
  getFarmerProfileByIdQuery: () => ({
    queryKey: ['profile', 'farmer', 'test'],
    queryFn: async () => mockPublicFarmerProfile,
  }),
  uploadMediaFile: vi.fn(),
}));

vi.mock('@/features/harvests/api/harvests.queries', () => ({
  getFarmerHarvestsQuery: () => ({
    queryKey: ['farmer-harvests'],
    queryFn: async () => mockPublicHarvests,
  }),
  getMarketplaceHarvestsQuery: () => ({
    queryKey: ['marketplace-harvests'],
    queryFn: async () => mockPublicHarvests,
  }),
}));

vi.mock('@/features/orders/api/orders.queries', () => ({
  getSellerOrdersQuery: () => ({
    queryKey: ['seller-orders'],
    queryFn: async () => [
      { id: 'ord-1', totalPrice: 500000, status: 'CONFIRMED' },
    ],
  }),
}));

vi.mock('@/features/admin/api/users.queries', () => ({
  useUpdateUser: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import { FarmerProfilePage } from './profile';
import { farmerLayoutStore } from '@/features/farmer/store/farmer-layout.store';

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

describe('FarmerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 'buyer-user-1',
      firstName: 'Buyer',
      lastName: 'Tester',
      email: 'buyer@futurefarm.sn',
      roles: ['Buyer'],
    };
  });

  it('renders public producer view when viewed by buyer (!isOwner)', async () => {
    mockUseSearch.mockReturnValue({ id: 'farmer-50' });

    renderWithClient(<FarmerProfilePage />);

    // Header & identity
    expect(await screen.findByText('Verdant Valley Estates')).toBeInTheDocument();
    expect(screen.getByLabelText('Retour')).toBeInTheDocument();
    expect(
      screen.getByText(/Premium Organic Soy & Corn Specialist since 2018/i),
    ).toBeInTheDocument();

    // 2-column stats: Products & Quality (NOT 4 columns with orders and revenue)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Produits')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Qualité')).toBeInTheDocument();
    expect(screen.queryByText('Commandes')).not.toBeInTheDocument();
    expect(screen.queryByText('FCFA')).not.toBeInTheDocument();

    // Active listings matching mockup
    expect(screen.getByText('Lots actifs')).toBeInTheDocument();
    expect(screen.getByText('Premium Soybeans')).toBeInTheDocument();
    expect(screen.getByText('Yellow Dent Corn')).toBeInTheDocument();
    expect(screen.getByText('LÉGUMINEUSES')).toBeInTheDocument();
    expect(screen.getByText('CÉRÉALES')).toBeInTheDocument();

    // Public view should NOT render edit button or any owner controls
    expect(screen.queryByText('Modifier le profil')).not.toBeInTheDocument();
    expect(screen.queryByText('Gérer stock')).not.toBeInTheDocument();
    expect(screen.queryByText('Compte & Sécurité')).not.toBeInTheDocument();
    expect(screen.queryByText('Déconnexion')).not.toBeInTheDocument();
    expect(screen.queryByText('Voir les analyses de lots')).not.toBeInTheDocument();

    // Bottom nav should be hidden for buyer view
    expect(farmerLayoutStore.state.hideBottomNav).toBe(true);
    expect(screen.getByTestId('farmer-profile-container')).toHaveClass('pb-10');
  });

  it('renders owner view when logged-in farmer views their own profile (isOwner)', async () => {
    // Current user matches the profile userId
    mockCurrentUser = {
      id: 'user-farmer-50',
      firstName: 'Amadou',
      lastName: 'Ba',
      email: 'amadou.ba@example.com',
      roles: ['Farmer'],
    };
    mockUseSearch.mockReturnValue({});

    renderWithClient(<FarmerProfilePage />);

    expect(await screen.findByText('Verdant Valley Estates')).toBeInTheDocument();

    // Owner controls visible
    expect(screen.getByText('Modifier le profil')).toBeInTheDocument();
    expect(screen.getByText('Gérer stock')).toBeInTheDocument();
    expect(screen.getByText('Compte & Sécurité')).toBeInTheDocument();
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
    expect(screen.getByText('Voir les analyses de lots')).toBeInTheDocument();

    // 4-column stats visible
    expect(screen.getByText('Commandes')).toBeInTheDocument();
    expect(screen.getByText('FCFA')).toBeInTheDocument();

    // Bottom nav should be active for owner view
    expect(farmerLayoutStore.state.hideBottomNav).toBe(false);
    expect(screen.getByTestId('farmer-profile-container')).toHaveClass('pb-24');
  });
});
