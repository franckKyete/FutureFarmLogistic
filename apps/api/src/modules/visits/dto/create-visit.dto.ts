import { IsString, IsDateString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { VisitReason } from '@futurefarm/types';

export class CreateVisitDto {
  @IsUUID()
  producerId: string;

  @IsDateString()
  plannedDate: string;

  @IsOptional()
  @IsString()
  plannedTime?: string;

  @IsEnum(VisitReason)
  reason: VisitReason;

  @IsOptional()
  @IsString()
  notes?: string;
}
