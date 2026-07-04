import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray } from 'class-validator';
import { CreateInspectorProfileDto } from '@futurefarm/types';

export class CreateInspectorProfileDtoClass implements CreateInspectorProfileDto {
  @ApiProperty({ example: 'INS-2026-98765' })
  @IsNotEmpty()
  @IsString()
  licenseNumber: string;

  @ApiProperty({ example: 'National Agricultural Inspection Authority' })
  @IsNotEmpty()
  @IsString()
  agencyName: string;

  @ApiProperty({ example: ['DATES', 'FRUITS', 'VEGETABLES'], type: [String] })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  specializations: string[];
}
