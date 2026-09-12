import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateInspectionCenterDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code: string;

  @IsNotEmpty({ message: 'La région d\'opération est obligatoire' })
  @IsString()
  @MaxLength(255)
  regionName: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  inspectorProfileIds?: string[];
}

export class UpdateInspectionCenterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  regionName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  inspectorProfileIds?: string[];
}

export class AssignInspectorDto {
  @IsNotEmpty()
  @IsString()
  inspectorProfileId: string;
}
