import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, Min, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeCalculationType, type CreatePlatformFeeDto } from '@futurefarm/types';

export class CreatePlatformFeeRequestDto implements CreatePlatformFeeDto {
  @ApiProperty({ description: 'Display name of the fee', example: 'Frais de livraison' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ description: 'Unique code for the fee', example: 'DELIVERY' })
  @IsString()
  @Length(2, 50)
  code: string;

  @ApiProperty({ enum: FeeCalculationType, example: FeeCalculationType.FIXED })
  @IsEnum(FeeCalculationType)
  calculationType: FeeCalculationType;

  @ApiProperty({ description: 'Amount or percentage', example: 2.90 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Base currency for fixed fees', example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether the fee is currently active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional description or helper text' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order priority', default: 0 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
