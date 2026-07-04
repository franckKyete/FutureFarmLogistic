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
  @ApiProperty({ example: ['http://example.com/photo1.jpg'], type: [String] })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoUrls: string[];

  @ApiPropertyOptional({ example: 'Harvested organic roma tomatoes' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}
