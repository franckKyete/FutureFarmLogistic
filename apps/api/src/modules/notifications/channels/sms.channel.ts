import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { NotificationChannel } from '@futurefarm/types';
import {
  INotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

@Injectable()
export class SmsChannel implements INotificationChannel {
  private readonly logger = new Logger(SmsChannel.name);
  readonly channel = NotificationChannel.SMS;
  private client: Twilio | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initClient();
  }

  private initClient() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not configured. SMS channel running in [DRY RUN] mode.',
      );
      return;
    }

    try {
      this.client = new Twilio(accountSid, authToken);
    } catch (err) {
      this.logger.error(
        'Failed to initialize Twilio client, using dry run mode.',
        err,
      );
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!payload.userPhone) {
      this.logger.warn(
        `Skipping SMS for user ${payload.userId}: phone number is not set.`,
      );
      return;
    }

    const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!this.client || !from) {
      this.logger.log(
        `[DRY RUN] SMS to ${payload.userPhone}: [${payload.priority}] ${payload.title} - ${payload.body}`,
      );
      return;
    }

    try {
      await this.client.messages.create({
        from,
        to: payload.userPhone,
        body: `${payload.title}: ${payload.body}`,
      });
      this.logger.log(`SMS successfully sent to ${payload.userPhone}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${payload.userPhone}`, err);
      throw err;
    }
  }
}
