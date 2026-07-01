import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { NotificationChannel } from '@futurefarm/types';
import {
  INotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

@Injectable()
export class WhatsAppChannel implements INotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);
  readonly channel = NotificationChannel.WHATSAPP;
  private client: Twilio | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initClient();
  }

  private initClient() {
    const isEnabled = this.configService.get<boolean>(
      'WHATSAPP_ENABLED',
      false,
    );
    if (!isEnabled) {
      this.logger.warn('WhatsApp feature flag WHATSAPP_ENABLED is false.');
      return;
    }

    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not configured for WhatsApp. Channel running in [DRY RUN] mode.',
      );
      return;
    }

    try {
      this.client = new Twilio(accountSid, authToken);
    } catch (err) {
      this.logger.error(
        'Failed to initialize Twilio client for WhatsApp, using dry run mode.',
        err,
      );
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!payload.userPhone) {
      this.logger.warn(
        `Skipping WhatsApp for user ${payload.userId}: phone number is not set.`,
      );
      return;
    }

    const from = this.configService.get<string>('TWILIO_WHATSAPP_FROM');

    if (!this.client || !from) {
      this.logger.log(
        `[DRY RUN] WhatsApp to ${payload.userPhone}: [${payload.priority}] ${payload.title} - ${payload.body}`,
      );
      return;
    }

    // Format target phone number for Twilio WhatsApp (must start with whatsapp:)
    const to = payload.userPhone.startsWith('whatsapp:')
      ? payload.userPhone
      : `whatsapp:${payload.userPhone}`;

    try {
      await this.client.messages.create({
        from,
        to,
        body: `${payload.title}: ${payload.body}`,
      });
      this.logger.log(`WhatsApp message successfully sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp message to ${to}`, err);
      throw err;
    }
  }
}
