import { IsOptional, IsString, IsUrl } from 'class-validator';

export class RegisterPushSubscriptionDto {
  @IsUrl()
  endpoint: string;

  @IsString()
  p256dh: string;

  @IsString()
  auth: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
