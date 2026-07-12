import { IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { VisitStatus } from '@futurefarm/types';

export class VisitFilterDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsUUID()
  producerId?: string;
}
