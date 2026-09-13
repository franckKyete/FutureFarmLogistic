import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class PlaceBidDto {
  @ApiPropertyOptional({
    description:
      'Max price threshold for auto-bid in Dutch auction. If omitted or >= current price, buys immediately at current price.',
    example: 45.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  autoBidMaxPrice?: number;

  @ApiPropertyOptional({
    description: 'Delivery address where the won lot will be delivered',
  })
  @IsOptional()
  deliveryAddress?: any;
}
