import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCurrencyRateDto {
  @ApiProperty({ description: 'Exchange rate against base USD (1 USD = X currency)' })
  @IsNumber()
  @Min(0.000001)
  rateAgainstBase: number;

  @ApiPropertyOptional({ description: 'Whether the currency is active for use' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
