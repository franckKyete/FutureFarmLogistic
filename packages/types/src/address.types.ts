// =============================================================================
// Address Types & Polymorphic Addressable Interfaces
// =============================================================================

export enum AddressType {
  SHIPPING = 'SHIPPING',
  BILLING = 'BILLING',
  COLLECTION = 'COLLECTION',
  WAREHOUSE = 'WAREHOUSE',
  OTHER = 'OTHER',
}

export enum AddressableType {
  USER = 'USER',
  ORDER = 'ORDER',
  COLLECTION_CENTER = 'COLLECTION_CENTER',
  FARMER_PROFILE = 'FARMER_PROFILE',
}

export interface AddressDto {
  id: string;
  addressableType: AddressableType;
  addressableId: string;
  type: AddressType;
  label?: string | null | undefined;
  recipientName?: string | null | undefined;
  phoneNumber?: string | null | undefined;
  streetAddress: string;
  streetAddress2?: string | null | undefined;
  city: string;
  stateOrProvince?: string | null | undefined;
  postalCode?: string | null | undefined;
  country: string;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressDto {
  addressableType?: AddressableType | undefined;
  addressableId?: string | undefined;
  type?: AddressType | undefined;
  label?: string | undefined;
  recipientName?: string | undefined;
  phoneNumber?: string | undefined;
  streetAddress: string;
  streetAddress2?: string | undefined;
  city: string;
  stateOrProvince?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isDefault?: boolean | undefined;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {}

export interface IAddressable {
  id: string;
  addresses?: AddressDto[] | undefined;
}
