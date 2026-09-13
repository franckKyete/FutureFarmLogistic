import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BuyerBusinessType } from '@futurefarm/types';

export class UpdateFarmerProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  regionName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  isCertified?: boolean;

  @IsOptional()
  addressDetails?: any;
}

export class UpdateBuyerProfileDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  vatNumber: string;

  @IsNotEmpty()
  @IsEnum(BuyerBusinessType)
  businessType: BuyerBusinessType;

  @IsNotEmpty()
  @IsString()
  billingAddress: string;

  @IsNotEmpty()
  @IsString()
  shippingAddress: string;

  @IsOptional()
  shippingAddressDetails?: any;

  @IsOptional()
  billingAddressDetails?: any;
}
