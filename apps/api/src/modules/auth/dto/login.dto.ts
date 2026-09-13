import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@futurefarm.io' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: true, description: 'Extend session validity up to 30 days' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Valid refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
