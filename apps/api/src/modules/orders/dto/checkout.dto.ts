import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryAddressDto {
  @ApiProperty({ example: '123 Farm Road' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Agricity' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Morocco' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: '40000' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;
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
}
