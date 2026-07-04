import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HarvestUnit } from '@futurefarm/types';
import { PriceDecayConfigDto } from './create-harvest.dto';

export class UpdateHarvestDto {
  @ApiPropertyOptional({ example: '2026-07-02' })
  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @ApiPropertyOptional({ example: '2026-08-05' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ example: 450.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityInStock?: number;

  @ApiPropertyOptional({ example: 20.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMarge?: number;

  @ApiPropertyOptional({ example: 4.25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  @ApiPropertyOptional({ enum: HarvestUnit, example: HarvestUnit.KG })
  @IsOptional()
  @IsEnum(HarvestUnit)
  unit?: HarvestUnit;

  @ApiPropertyOptional({ example: 'Farming methods updated description.' })
  @IsOptional()
  @IsString()
  farmingMethods?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/photos/harvest-1-updated.jpg'],
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
