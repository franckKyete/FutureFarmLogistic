import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductCategory } from '@futurefarm/types';

export class CreateProductDto {
  @ApiProperty({ example: 'Medjool Dates' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({
    example: 'Premium quality sweet organic dates.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProductCategory, example: ProductCategory.DATES })
  @IsNotEmpty()
  @IsEnum(ProductCategory)
  category: ProductCategory;
}
