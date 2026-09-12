import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';

export class RegisterInspectorDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  agencyName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @IsArray({ message: 'Les centres d’inspection doivent être fournis sous forme de liste' })
  @ArrayMinSize(1, { message: 'Au moins un centre d’inspection doit être assigné à l’inspecteur' })
  @IsUUID('4', { each: true, message: 'Chaque identifiant de centre d’inspection doit être un UUID valide' })
  inspectionCenterIds: string[];
}
