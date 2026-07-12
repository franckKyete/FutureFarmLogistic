import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateVisitDto {
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  plannedTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
