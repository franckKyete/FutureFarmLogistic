import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverProfileDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 'DL-98234-A' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 50)
  licenseNumber: string;

  @ApiProperty({ example: 'C' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 10)
  licenseCategory: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'DL-98234-A' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'C' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  licenseCategory?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
