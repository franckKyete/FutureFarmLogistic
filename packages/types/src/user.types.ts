// =============================================================================
// @futurefarm/types — User, Profiles, and Parcels Types
// =============================================================================

export enum UserStatus {
  PENDING_VALIDATION = 'pending_validation',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum BuyerBusinessType {
  RESTAURATEUR = 'restaurateur',
  GROSSISTE = 'grossiste',
  INDUSTRIEL = 'industriel',
}

export enum ParcelStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export interface FarmerProfileDto {
  companyName: string;
  address: string;
  bio?: string;
  isCertified: boolean;
}

export interface BuyerProfileDto {
  companyName: string;
  vatNumber: string;
  businessType: BuyerBusinessType;
  billingAddress: string;
  shippingAddress: string;
}

export interface ParcelDto {
  id: string;
  cadastralNumber: string;
  sizeHectares: number;
  locationCoordinates: string;
  cropTypes: string[];
  status: ParcelStatus;
  verifiedAt?: string;
}
