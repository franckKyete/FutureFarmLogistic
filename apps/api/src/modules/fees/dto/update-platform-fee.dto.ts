import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, Min, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FeeCalculationType, type UpdatePlatformFeeDto } from '@futurefarm/types';

export class UpdatePlatformFeeRequestDto implements UpdatePlatformFeeDto {
  @ApiPropertyOptional({ description: 'Display name of the fee' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ description: 'Unique code for the fee' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  code?: string;

  @ApiPropertyOptional({ enum: FeeCalculationType })
  @IsOptional()
  @IsEnum(FeeCalculationType)
  calculationType?: FeeCalculationType;

  @ApiPropertyOptional({ description: 'Amount or percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: 'Base currency for fixed fees' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether the fee is currently active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional description or helper text' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order priority' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
