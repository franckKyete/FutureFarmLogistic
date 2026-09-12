// =============================================================================
// Platform Fees & Order Additional Fees Shared Types
// =============================================================================

export enum FeeCalculationType {
  FIXED = 'FIXED', // Fixed amount in USD base currency (e.g., $2.90 delivery, $0.50 service)
  PERCENTAGE = 'PERCENTAGE', // Percentage of crop subtotal (e.g., 5.0% platform fee, 18.0% VAT)
}

export interface PlatformFeeConfigDto {
  id: string;
  name: string; // e.g. "Frais de livraison", "Frais de service", "TVA"
  code: string; // e.g. "DELIVERY", "SERVICE", "VAT"
  calculationType: FeeCalculationType;
  value: number; // e.g. 2.90 or 5.0
  currency: string; // 'USD' for fixed fees
  isActive: boolean;
  description?: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformFeeDto {
  name: string;
  code: string;
  calculationType: FeeCalculationType;
  value: number;
  currency?: string | undefined;
  isActive?: boolean | undefined;
  description?: string | null | undefined;
  displayOrder?: number | undefined;
}

export interface UpdatePlatformFeeDto {
  name?: string | undefined;
  code?: string | undefined;
  calculationType?: FeeCalculationType | undefined;
  value?: number | undefined;
  currency?: string | undefined;
  isActive?: boolean | undefined;
  description?: string | null | undefined;
  displayOrder?: number | undefined;
}

export interface OrderAppliedFeeDto {
  feeConfigId?: string;
  name: string;
  code: string;
  calculationType: FeeCalculationType;
  rateOrValue: number;
  amount: number; // in order currency
  amountUSD: number; // in USD
}
