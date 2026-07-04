import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateBasketLineDto {
  @ApiProperty({ example: 10.0, description: 'Updated quantity' })
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
