import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsObject, IsString } from 'class-validator';
import {
  UpdateInspectionReportDto,
  InspectionChecklist,
} from '@futurefarm/types';

export class UpdateInspectionReportDtoClass implements UpdateInspectionReportDto {
  @ApiPropertyOptional({ example: '2026-07-05' })
  @IsOptional()
  @IsDateString()
  siteVisitDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checklist?: Partial<InspectionChecklist>;

  @ApiPropertyOptional({ example: 'Additional notes on quality.' })
  @IsOptional()
  @IsString()
  overallNotes?: string;
}
