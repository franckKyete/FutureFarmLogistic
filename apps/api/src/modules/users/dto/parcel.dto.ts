import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { ParcelStatus } from '@futurefarm/types';

export class CreateParcelDto {
  @IsNotEmpty()
  @IsString()
  cadastralNumber: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  sizeHectares: number;

  @IsNotEmpty()
  @IsString()
  locationCoordinates: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  cropTypes: string[];
}

export class VerifyParcelDto {
  @IsNotEmpty()
  @IsEnum([ParcelStatus.VERIFIED, ParcelStatus.REJECTED])
  status: ParcelStatus;
}
