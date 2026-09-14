import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsArray,
  IsString,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { AiClassifyHarvestDto } from '@futurefarm/types';

export class AiClassifyHarvestDtoClass implements AiClassifyHarvestDto {
  @ApiProperty({
    example: ['http://example.com/photo1.jpg', 'http://example.com/photo2.jpg'],
    type: [String],
    description: 'Au moins 10 photos sous différents angles sont requises pour l\'analyse IA',
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(10, {
    message: 'Au moins 10 photos sous différents angles sont requises pour l\'analyse IA',
  })
  @IsString({ each: true })
  photoUrls: string[];

  @ApiPropertyOptional({ example: 'Harvested organic roma tomatoes' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}
