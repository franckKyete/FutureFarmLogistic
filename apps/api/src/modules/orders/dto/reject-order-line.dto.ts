import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RejectOrderLineDto {
  @ApiProperty({ example: 'Crop damaged during transit or quality lower than grade.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}
