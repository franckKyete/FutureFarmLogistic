import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BuyerBusinessType } from '@futurefarm/types';

export class UpdateFarmerProfileDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  bio?: string;
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
}
