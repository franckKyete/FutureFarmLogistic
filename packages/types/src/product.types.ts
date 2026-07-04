// =============================================================================
// Product & Harvest Types
// =============================================================================

export enum ProductCategory {
  CEREALS = 'CEREALS',
  FRUITS = 'FRUITS',
  VEGETABLES = 'VEGETABLES',
  DATES = 'DATES',
  DAIRY = 'DAIRY',
  MEAT = 'MEAT',
  OTHER = 'OTHER',
}

export enum HarvestStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum HarvestUnit {
  KG = 'KG',
  TON = 'TON',
  PIECE = 'PIECE',
}

export interface PriceDecayStep {
  daysBeforeExpiration: number;
  priceMultiplier: number; // e.g. 0.8 for 20% discount
}

export interface PriceDecayConfig {
  decaySteps: PriceDecayStep[];
}

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description: string;
  category: ProductCategory;
}

export interface HarvestDto {
  id: string;
  productId: string;
  product?: ProductDto;
  farmerProfileId: string;
  parcelId?: string | null;
  harvestDate: string;
  expirationDate: string;
  quantityInStock: number;
  stockMarge: number;
  pricePerUnit: number;
  unit: HarvestUnit;
  farmingMethods: string;
  photoUrls: string[];
  status: HarvestStatus;
  qualityScore?: number | null;
  priceDecayConfig?: PriceDecayConfig | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHarvestDto {
  productId: string;
  parcelId?: string | null;
  harvestDate: string;
  expirationDate: string;
  quantityInStock: number;
  stockMarge: number;
  pricePerUnit: number;
  unit: HarvestUnit;
  farmingMethods: string;
  photoUrls: string[];
  priceDecayConfig?: PriceDecayConfig | null;
}

export interface UpdateHarvestDto {
  harvestDate?: string;
  expirationDate?: string;
  quantityInStock?: number;
  stockMarge?: number;
  pricePerUnit?: number;
  unit?: HarvestUnit;
  farmingMethods?: string;
  photoUrls?: string[];
  priceDecayConfig?: PriceDecayConfig | null;
}

export interface VerifyHarvestDto {
  status: HarvestStatus.APPROVED | HarvestStatus.REJECTED;
  qualityScore?: number;
  rejectionReason?: string;
}

export interface AiSuggestHarvestResponseDto {
  suggestedName: string;
  category: ProductCategory;
  description: string;
  farmingMethods: string;
  recommendedShelfLifeDays: number;
}
