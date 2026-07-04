import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiSuggestHarvestDto {
  @ApiProperty({ example: 'Tomates cerises bio récoltées ce matin' })
  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  prompt: string;
}
