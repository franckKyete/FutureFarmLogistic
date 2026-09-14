import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDriverDto {
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

  @IsNotEmpty()
  @IsString()
  licenseNumber: string;

  @IsNotEmpty()
  @IsString()
  licenseCategory: string;

  @IsOptional()
  @IsString()
  licenseExpiresAt?: string;

  // Vehicle details (assigned during registration)
  @IsOptional()
  @IsString()
  vehicleBrand?: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  vehicleCapacityKg?: number;

  @IsOptional()
  vehicleCapacityM3?: number;
}
