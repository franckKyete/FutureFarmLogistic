import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterFarmerDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty({ message: 'La région d\'activité est obligatoire' })
  @IsString()
  regionName: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsNotEmpty({ message: 'La localisation GPS (latitude) est obligatoire' })
  @IsNumber({}, { message: 'La latitude doit être un nombre valide' })
  latitude: number;

  @IsNotEmpty({ message: 'La localisation GPS (longitude) est obligatoire' })
  @IsNumber({}, { message: 'La longitude doit être un nombre valide' })
  longitude: number;
}
