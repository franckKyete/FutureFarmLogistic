import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HarvestUnit } from '@futurefarm/types';

export class PriceDecayStepDto {
  @ApiProperty({
    example: 5,
    description: 'Number of days before expiration when this price applies',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  daysBeforeExpiration: number;

  @ApiProperty({
    example: 0.8,
    description: 'Price multiplier (e.g. 0.8 for 20% discount)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(1)
  priceMultiplier: number;
}

export class PriceDecayConfigDto {
  @ApiProperty({ type: [PriceDecayStepDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDecayStepDto)
  decaySteps: PriceDecayStepDto[];
}

export class CreateHarvestDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parcelId?: string | null;

  @ApiProperty({ example: '2026-07-01' })
  @IsNotEmpty()
  @IsDateString()
  harvestDate: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsNotEmpty()
  @IsDateString()
  expirationDate: string;

  @ApiProperty({
    example: 500.0,
    description: 'Quantity harvested and currently in stock',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantityInStock: number;

  @ApiPropertyOptional({
    example: 25.0,
    description: 'Safety buffer stock margin',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMarge?: number;

  @ApiProperty({ example: 4.5, description: 'Price per unit' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @ApiProperty({ enum: HarvestUnit, example: HarvestUnit.KG })
  @IsNotEmpty()
  @IsEnum(HarvestUnit)
  unit: HarvestUnit;

  @ApiPropertyOptional({
    example: 'Cultivated using biological fertilizers, hand harvested.',
  })
  @IsOptional()
  @IsString()
  farmingMethods?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/photos/harvest-1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiPropertyOptional({ type: PriceDecayConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceDecayConfigDto)
  priceDecayConfig?: PriceDecayConfigDto | null;
}
