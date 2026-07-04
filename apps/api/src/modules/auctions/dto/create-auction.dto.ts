import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateAuctionDto as ICreateAuctionDto } from '@futurefarm/types';

export class CreateAuctionDto implements ICreateAuctionDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsNotEmpty()
  @IsUUID()
  harvestId: string;

  @ApiProperty({
    example: 100.0,
    description: 'Starting price of the Dutch auction',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  startingPrice: number;

  @ApiProperty({
    example: 40.0,
    description: 'Floor price where auction stops dropping and expires',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  reservePrice: number;

  @ApiProperty({
    example: 5.0,
    description: 'Amount the price drops per interval',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  priceDecrementAmount: number;

  @ApiProperty({ example: 10, description: 'Decrement interval in minutes' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  priceDecrementIntervalMinutes: number;

  @ApiProperty({ example: '2026-07-04T18:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-07-05T18:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  endAt: string;

  @ApiProperty({
    example: 150.0,
    description: 'Quantity of harvest put up for auction',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantityOnOffer: number;
}
