import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateAuctionDto as IUpdateAuctionDto } from '@futurefarm/types';

export class UpdateAuctionDto implements IUpdateAuctionDto {
  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  startingPrice?: number;

  @ApiPropertyOptional({ example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  priceDecrementAmount?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priceDecrementIntervalMinutes?: number;

  @ApiPropertyOptional({ example: '2026-07-04T19:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-07-05T19:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
