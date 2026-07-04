import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min } from 'class-validator';

export class AddBasketLineDto {
  @ApiProperty({ example: 'uuid', description: 'Harvest batch ID' })
  @IsUUID()
  harvestId: string;

  @ApiProperty({ example: 50.0, description: 'Quantity to purchase' })
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
