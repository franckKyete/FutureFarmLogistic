import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationPriority,
  Permission,
} from '@futurefarm/types';

export class BroadcastNotificationDto {
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

  @IsString()
  @IsOptional()
  filterByRole?: string;

  @IsEnum(Permission)
  @IsOptional()
  filterByPermission?: Permission;
}
