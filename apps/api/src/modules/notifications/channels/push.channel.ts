import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';

import { NotificationChannel } from '@futurefarm/types';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import {
  INotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

@Injectable()
export class PushChannel implements INotificationChannel {
  private readonly logger = new Logger(PushChannel.name);
  readonly channel = NotificationChannel.PUSH;
  private isConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PushSubscriptionEntity)
    private readonly subscriptionRepository: Repository<PushSubscriptionEntity>,
  ) {
    this.initConfig();
  }

  private initConfig() {
    const isEnabled = this.configService.get<boolean>('PUSH_ENABLED', false);
    if (!isEnabled) {
      this.logger.warn('Push notification feature flag PUSH_ENABLED is false.');
      return;
    }

    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:admin@futurefarm.io',
    );

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured. Push channel running in [DRY RUN] mode.',
      );
      return;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
    } catch (err) {
      this.logger.error('Failed to configure web-push VAPID details', err);
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    const subscriptions = await this.subscriptionRepository.findBy({
      userId: payload.userId,
    });

    if (subscriptions.length === 0) {
      this.logger.log(
        `No push subscriptions found for user ${payload.userId}. Skipping.`,
      );
      return;
    }

    if (!this.isConfigured) {
      this.logger.log(
        `[DRY RUN] Push to user ${payload.userId} (${subscriptions.length} devices): [${payload.priority}] ${payload.title} - ${payload.body}`,
      );
      return;
    }

    const notificationPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        data: {
          notificationId: payload.notificationId,
          priority: payload.priority,
          ...payload.metadata,
        },
      },
    });

    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        this.logger.log(`Push notification sent to device: ${sub.id}`);
      } catch (err: unknown) {
        // If the push service returns 404 or 410, the subscription is expired or invalid.
        // We should remove it from the DB.
        const error = err as { statusCode?: number };
        if (error.statusCode === 404 || error.statusCode === 410) {
          this.logger.warn(
            `Push subscription ${sub.id} expired or gone. Deleting.`,
          );
          await this.subscriptionRepository.delete({ id: sub.id });
        } else {
          this.logger.error(
            `Failed to send push notification to device: ${sub.id}`,
            err,
          );
        }
      }
    });

    await Promise.all(promises);
  }
}
