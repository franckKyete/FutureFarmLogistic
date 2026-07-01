import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { BuyerBusinessType } from '@futurefarm/types';

export class RegisterBuyerDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

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
