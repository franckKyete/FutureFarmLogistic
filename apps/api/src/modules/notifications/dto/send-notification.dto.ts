import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsObject,
} from 'class-validator';
import { NotificationChannel, NotificationPriority } from '@futurefarm/types';

export class SendNotificationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  recipientIds: string[];

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  body: string;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.NORMAL;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
