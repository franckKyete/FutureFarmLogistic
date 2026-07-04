import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsDateString, IsObject } from 'class-validator';
import {
  CreateInspectionReportDto,
  InspectionChecklist,
} from '@futurefarm/types';

export class CreateInspectionReportDtoClass implements CreateInspectionReportDto {
  @ApiProperty({ example: 'harvest-uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  harvestId: string;

  @ApiProperty({ example: '2026-07-04' })
  @IsNotEmpty()
  @IsDateString()
  siteVisitDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  checklist: InspectionChecklist;
}
