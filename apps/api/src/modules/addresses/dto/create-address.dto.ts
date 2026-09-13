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
  addressableType?: AddressableType | undefined;

  @ApiPropertyOptional({ description: 'Target entity ID (e.g. User, Center, Order)' })
  @IsOptional()
  @IsUUID()
  addressableId?: string | undefined;

  @ApiPropertyOptional({ enum: AddressType, default: AddressType.SHIPPING })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType | undefined;

  @ApiPropertyOptional({ example: 'Domicile' })
  @IsOptional()
  @IsString()
  label?: string | undefined;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  recipientName?: string | undefined;

  @ApiPropertyOptional({ example: '+243990000000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string | undefined;

  @ApiProperty({ example: '12 Avenue de la Paix' })
  @IsNotEmpty()
  @IsString()
  streetAddress: string;

  @ApiPropertyOptional({ example: 'Appartement 4B' })
  @IsOptional()
  @IsString()
  streetAddress2?: string | undefined;

  @ApiProperty({ example: 'Kinshasa' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Kinshasa' })
  @IsOptional()
  @IsString()
  stateOrProvince?: string | undefined;

  @ApiPropertyOptional({ example: '10000' })
  @IsOptional()
  @IsString()
  postalCode?: string | undefined;

  @ApiPropertyOptional({ example: 'COD', default: 'COD' })
  @IsOptional()
  @IsString()
  country?: string | undefined;

  @ApiPropertyOptional({ example: -4.325 })
  @IsOptional()
  @IsNumber()
  latitude?: number | undefined;

  @ApiPropertyOptional({ example: 15.322 })
  @IsOptional()
  @IsNumber()
  longitude?: number | undefined;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean | undefined;
}
