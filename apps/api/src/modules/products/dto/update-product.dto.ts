import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '@futurefarm/types';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Medjool Dates' })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional({
    example: 'Premium quality sweet organic dates.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProductCategory, example: ProductCategory.DATES })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;
}
