import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'ISO 3-letter country code, e.g. COD, SEN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Preferred currency code, e.g. CDF, USD, XOF' })
  @IsOptional()
  @IsString()
  preferredCurrency?: string;
}
