import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Verify2faDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}

export class Authenticate2faDto {
  @IsNotEmpty()
  @IsString()
  tempToken: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
