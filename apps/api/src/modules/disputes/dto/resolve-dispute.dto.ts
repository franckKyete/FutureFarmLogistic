import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { DisputeStatus } from '@futurefarm/types';

export class ResolveDisputeDtoClass {
  @ApiProperty({ example: 'After reviewing the evidence, we upgraded the grade to A.' })
  @IsNotEmpty()
  @IsString()
  resolutionNotes: string;

  @ApiPropertyOptional({ enum: DisputeStatus, default: DisputeStatus.RESOLVED })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus.RESOLVED | DisputeStatus.DISMISSED;
}
