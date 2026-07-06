import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { NotificationEntity } from './entities/notification.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { UserEntity } from '../users/entities/user.entity';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsGateway } from './notifications.gateway';

import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { DatabaseChannel } from './channels/database.channel';
import { PushChannel } from './channels/push.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      PushSubscriptionEntity,
      NotificationPreferencesEntity,
      UserEntity,
    ]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    NotificationsGateway,
    EmailChannel,
    SmsChannel,
    DatabaseChannel,
    PushChannel,
    WhatsAppChannel,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
