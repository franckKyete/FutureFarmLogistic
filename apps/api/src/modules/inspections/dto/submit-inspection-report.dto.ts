import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';
import {
  SubmitInspectionReportDto,
  InspectionChecklist,
} from '@futurefarm/types';

export class SubmitInspectionReportDtoClass implements SubmitInspectionReportDto {
  @ApiProperty({ example: 8.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(10)
  finalQualityScore: number;

  @ApiPropertyOptional({
    example:
      'The harvest matches the visual description and passed all checks.',
  })
  @IsOptional()
  @IsString()
  overallNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checklist?: InspectionChecklist;
}
