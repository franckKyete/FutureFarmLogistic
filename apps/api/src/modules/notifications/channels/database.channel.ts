import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificationChannel, NotificationStatus } from '@futurefarm/types';
import { NotificationEntity } from '../entities/notification.entity';
import {
  INotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

@Injectable()
export class DatabaseChannel implements INotificationChannel {
  private readonly logger = new Logger(DatabaseChannel.name);
  readonly channel = NotificationChannel.DATABASE;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    try {
      const notification = await this.notificationRepository.findOneBy({
        id: payload.notificationId,
      });
      if (notification) {
        notification.status = NotificationStatus.SENT;
        await this.notificationRepository.save(notification);
        this.logger.log(
          `Notification status updated to SENT in database for user ${payload.userId}`,
        );
      } else {
        this.logger.warn(
          `Could not find NotificationEntity with ID ${payload.notificationId} to update status.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to update notification status in database`,
        err,
      );
      throw err;
    }
  }
}
