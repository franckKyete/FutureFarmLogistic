import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { DisputeSeverity, CreateDisputeDto } from '@futurefarm/types';

export class CreateDisputeDtoClass implements CreateDisputeDto {
  @ApiProperty({ example: 'Incorrect quality grading' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'The harvest was graded B but should be A based on visual inspection.' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ enum: DisputeSeverity, example: DisputeSeverity.HIGH })
  @IsNotEmpty()
  @IsEnum(DisputeSeverity)
  severity: DisputeSeverity;

  @ApiProperty({ example: 'order', description: 'Related entity type: order, inspection, or delivery' })
  @IsNotEmpty()
  @IsString()
  relatedType: 'order' | 'inspection' | 'delivery';

  @ApiProperty({ example: '07c7a5b1-1234-5678-9abc-def012345678' })
  @IsNotEmpty()
  @IsString()
  relatedId: string;
}
