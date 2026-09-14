import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryAddressDto {
  @ApiPropertyOptional({ example: 'uuid-address-id' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsString()
  @IsOptional()
  recipientName?: string;

  @ApiPropertyOptional({ example: '+243990000000' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '123 Farm Road' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({ example: '12 Avenue de la Paix' })
  @IsString()
  @IsOptional()
  streetAddress?: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsString()
  @IsOptional()
  streetAddress2?: string;

  @ApiProperty({ example: 'Kinshasa' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'Kinshasa' })
  @IsString()
  @IsOptional()
  stateOrProvince?: string;

  @ApiProperty({ example: 'COD' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ example: '10000' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: -4.325 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 15.322 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Domicile' })
  @IsString()
  @IsOptional()
  label?: string;
}

export class CheckoutDto {
  @ApiProperty({ type: DeliveryAddressDto })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress: DeliveryAddressDto;

  @ApiPropertyOptional({ example: 'Deliver near the north gate.' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'mobile_money', enum: ['stripe', 'mobile_money'] })
  @IsString()
  @IsOptional()
  paymentMethod?: 'stripe' | 'mobile_money';

  @ApiPropertyOptional({ example: '+221770000000', description: 'Payer phone number for Mobile Money' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'orange', description: 'MMO Provider code (e.g. orange, wave, free)' })
  @IsString()
  @IsOptional()
  mmoProvider?: string;

  @ApiPropertyOptional({ example: 'CDF', description: 'Buyer selected payment currency code (e.g. CDF, USD, XOF, EUR)' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'http://192.168.1.50:3001', description: 'Base origin of the client initiating checkout' })
  @IsString()
  @IsOptional()
  clientOrigin?: string;

  @ApiPropertyOptional({ example: 'http://192.168.1.50:3001/orders', description: 'Explicit return URL for payment redirection' })
  @IsString()
  @IsOptional()
  returnUrl?: string;
}
