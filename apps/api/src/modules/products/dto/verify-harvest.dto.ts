import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HarvestStatus } from '@futurefarm/types';

export class VerifyHarvestDto {
  @ApiProperty({
    enum: [
      HarvestStatus.APPROVED,
      HarvestStatus.REJECTED,
      HarvestStatus.FLAGGED_PHYSICAL,
    ],
    example: HarvestStatus.APPROVED,
  })
  @IsNotEmpty()
  @IsEnum([
    HarvestStatus.APPROVED,
    HarvestStatus.REJECTED,
    HarvestStatus.FLAGGED_PHYSICAL,
  ])
  status:
    | HarvestStatus.APPROVED
    | HarvestStatus.REJECTED
    | HarvestStatus.FLAGGED_PHYSICAL;

  @ApiPropertyOptional({
    example: 8.5,
    description: 'Quality score rating out of 10',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  qualityScore?: number;

  @ApiPropertyOptional({ example: 'Spoilage detected on some items.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
