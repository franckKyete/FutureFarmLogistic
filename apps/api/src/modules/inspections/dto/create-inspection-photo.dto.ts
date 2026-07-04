import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { CreateInspectionPhotoDto } from '@futurefarm/types';

export class CreateInspectionPhotoDtoClass implements CreateInspectionPhotoDto {
  @ApiProperty({ example: 'http://example.com/photo.jpg' })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiPropertyOptional({ example: 102456 })
  @IsOptional()
  @IsInt()
  size?: number | null;

  @ApiPropertyOptional({ example: '2026-07-04T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  takenAt?: string | null;

  @ApiPropertyOptional({ example: 34.0522 })
  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @ApiPropertyOptional({ example: -118.2437 })
  @IsOptional()
  @IsNumber()
  longitude?: number | null;
}
