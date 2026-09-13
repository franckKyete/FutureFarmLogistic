import { OmitType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { HarvestStatus, type InspectionChecklist } from '@futurefarm/types';
import { CreateHarvestDto } from './create-harvest.dto';

export class CreateHarvestProxyDto extends OmitType(CreateHarvestDto, [
  'productId',
  'qualityScore',
] as const) {
  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Farmer user ID for whom the harvest is being recorded',
  })
  @IsNotEmpty()
  @IsUUID()
  farmerUserId: string;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Existing product template ID (optional if productName is provided)',
  })
  @IsOptional()
  @IsUUID()
  productId?: string | undefined;

  @ApiPropertyOptional({
    example: 'Tomates fraîches',
    description: 'Custom crop name if product template ID is not selected',
  })
  @IsOptional()
  @IsString()
  productName?: string | undefined;

  @ApiPropertyOptional({
    example: 8.5,
    description: 'Inspection certified quality score (0-10)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  qualityScore?: number | undefined;

  @ApiPropertyOptional({
    enum: HarvestStatus,
    example: HarvestStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(HarvestStatus)
  status?: HarvestStatus | undefined;

  @ApiPropertyOptional({
    example: 'Inspection physique réalisée avec succès sur le terrain',
  })
  @IsOptional()
  @IsString()
  auditNotes?: string | undefined;

  @ApiPropertyOptional({
    description: 'Detailed inspection compliance checklist',
  })
  @IsOptional()
  checklist?: InspectionChecklist | undefined;
}
