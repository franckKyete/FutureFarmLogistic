import type { UserStatus, Permission } from '@futurefarm/types';

export interface DriverProfileInfo {
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiresAt?: string | null;
  isAvailable: boolean;
  averageRating?: number | null;
  totalDeliveriesCompleted: number;
}

export interface InspectorProfileInfo {
  licenseNumber: string;
  agencyName: string;
  specializations: string[];
  isActiveInspector: boolean;
}

export interface FarmerParcelInfo {
  id: string;
  cadastralNumber: string;
  sizeHectares: number;
  locationCoordinates?: string;
  cropTypes: string[];
  status: string;
  verifiedAt?: string;
}

export interface FarmerProfileInfo {
  companyName: string;
  address: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isCertified: boolean;
  parcels?: FarmerParcelInfo[];
}

export interface BuyerProfileInfo {
  companyName: string;
  vatNumber: string;
  businessType: string;
  billingAddress: string;
  shippingAddress: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  isActive: boolean;
  phone?: string | null;
  roles: Array<{ id: string; name: string }>;
  profile?: DriverProfileInfo | InspectorProfileInfo | FarmerProfileInfo | BuyerProfileInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoleDto {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}
