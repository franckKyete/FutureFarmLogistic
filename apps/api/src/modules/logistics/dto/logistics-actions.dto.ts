import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PickupCondition } from '@futurefarm/types';

export class SubmitPickupReportDto {
  @ApiProperty({ description: 'Whether the quantity matches the order' })
  @IsBoolean()
  @IsNotEmpty()
  quantityVerified: boolean;

  @ApiProperty({ enum: PickupCondition, description: 'Condition of the produce' })
  @IsEnum(PickupCondition)
  @IsNotEmpty()
  conditionOk: PickupCondition;

  @ApiProperty({ description: 'Whether packaging is intact and clean' })
  @IsBoolean()
  @IsNotEmpty()
  packagingIntact: boolean;

  @ApiProperty({ example: 25.5, description: 'Actual weighed weight in kg' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  weightActualKg: number;

  @ApiPropertyOptional({ description: 'Driver notes or remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PushLocationDto {
  @ApiPropertyOptional({ description: 'Current active delivery run ID' })
  @IsOptional()
  @IsString()
  runId?: string;

  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @IsNotEmpty()
  lon: number;

  @ApiPropertyOptional({ description: 'Compass heading (0-360)' })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional({ description: 'Speed in km/h' })
  @IsOptional()
  @IsNumber()
  speedKmh?: number;
}

export class SkipStopDto {
  @ApiProperty({ description: 'Reason for skipping stop' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

