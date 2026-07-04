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
}
