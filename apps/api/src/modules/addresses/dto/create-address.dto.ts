import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { AddressType, AddressableType } from '@futurefarm/types';

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: AddressableType })
  @IsOptional()
  @IsEnum(AddressableType)
  addressableType?: AddressableType;

  @ApiPropertyOptional({ description: 'Target entity ID (e.g. User, Center, Order)' })
  @IsOptional()
  @IsUUID()
  addressableId?: string;

  @ApiPropertyOptional({ enum: AddressType, default: AddressType.SHIPPING })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({ example: 'Domicile' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ example: '+243990000000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ example: '12 Avenue de la Paix' })
  @IsNotEmpty()
  @IsString()
  streetAddress: string;

  @ApiPropertyOptional({ example: 'Appartement 4B' })
  @IsOptional()
  @IsString()
  streetAddress2?: string;

  @ApiProperty({ example: 'Kinshasa' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Kinshasa' })
  @IsOptional()
  @IsString()
  stateOrProvince?: string;

  @ApiPropertyOptional({ example: '10000' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'COD', default: 'COD' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: -4.325 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 15.322 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
