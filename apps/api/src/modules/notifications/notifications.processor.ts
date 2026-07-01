import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { Repository } from 'typeorm';

import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  Permission,
} from '@futurefarm/types';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { NotificationEntity } from './entities/notification.entity';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { DatabaseChannel } from './channels/database.channel';
import { PushChannel } from './channels/push.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import {
  INotificationChannel,
  NotificationPayload,
} from './channels/notification-channel.interface';

interface SendJobData {
  notificationId: string;
  userId: string;
}

interface BroadcastJobData {
  title: string;
  body: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  metadata: Record<string, unknown> | null;
  filterByRole?: string;
  filterByPermission?: Permission;
}

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly channelMap = new Map<
    NotificationChannel,
    INotificationChannel
  >();

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferencesEntity)
    private readonly preferencesRepository: Repository<NotificationPreferencesEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel,
    private readonly databaseChannel: DatabaseChannel,
    private readonly pushChannel: PushChannel,
    private readonly whatsappChannel: WhatsAppChannel,
  ) {
    this.channelMap.set(NotificationChannel.EMAIL, this.emailChannel);
    this.channelMap.set(NotificationChannel.SMS, this.smsChannel);
    this.channelMap.set(NotificationChannel.DATABASE, this.databaseChannel);
    this.channelMap.set(NotificationChannel.PUSH, this.pushChannel);
    this.channelMap.set(NotificationChannel.WHATSAPP, this.whatsappChannel);
  }

  @Process('send')
  async handleSend(job: Job<SendJobData>): Promise<void> {
    const { notificationId, userId } = job.data;
    this.logger.log(
      `Processing send job ${job.id} for user ${userId}, notification ${notificationId}`,
    );

    try {
      const user = await this.userRepository.findOneBy({ id: userId });
      if (!user) {
        this.logger.warn(
          `User ${userId} not found for notification ${notificationId}. Aborting.`,
        );
        return;
      }

      const notification = await this.notificationRepository.findOneBy({
        id: notificationId,
      });
      if (!notification) {
        this.logger.warn(`Notification ${notificationId} not found. Aborting.`);
        return;
      }

      // Load user preferences (default to all enabled if not specified)
      let preferences = await this.preferencesRepository.findOneBy({ userId });
      if (!preferences) {
        preferences = new NotificationPreferencesEntity();
        preferences.userId = userId;
        preferences.emailEnabled = true;
        preferences.smsEnabled = true;
        preferences.databaseEnabled = true;
        preferences.pushEnabled = true;
        preferences.whatsappEnabled = true;
      }

      const payload: NotificationPayload = {
        userId: user.id,
        userEmail: user.email,
        userPhone: user.phoneNumber,
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        metadata: notification.metadata || {},
        notificationId: notification.id,
      };

      const requestedChannels = notification.channels;
      const sendPromises = requestedChannels.map(async (channelType) => {
        // Check preferences for this channel
        let isEnabled = true;
        if (channelType === NotificationChannel.EMAIL)
          isEnabled = preferences.emailEnabled;
        if (channelType === NotificationChannel.SMS)
          isEnabled = preferences.smsEnabled;
        if (channelType === NotificationChannel.DATABASE)
          isEnabled = preferences.databaseEnabled;
        if (channelType === NotificationChannel.PUSH)
          isEnabled = preferences.pushEnabled;
        if (channelType === NotificationChannel.WHATSAPP)
          isEnabled = preferences.whatsappEnabled;

        if (!isEnabled) {
          this.logger.log(
            `Channel ${channelType} is disabled in preferences for user ${userId}. Skipping.`,
          );
          return;
        }

        const channel = this.channelMap.get(channelType);
        if (channel) {
          try {
            await channel.send(payload);
          } catch (err) {
            this.logger.error(
              `Error sending via channel ${channelType} to user ${userId}`,
              err,
            );
            // We do not rethrow immediately so other channels can proceed, but we will mark job as failed later if needed
            throw err;
          }
        } else {
          this.logger.warn(`Unsupported channel type: ${channelType}`);
        }
      });

      const results = await Promise.allSettled(sendPromises);
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        // If there were any failures, update notification status to failed (or partial fail)
        notification.status = NotificationStatus.FAILED;
        await this.notificationRepository.save(notification);
        throw new Error(
          `Failed to send notification via ${failures.length} channels.`,
        );
      }

      // If database channel was not explicitly in the requested channels, the status won't be updated by DatabaseChannel.
      // In that case, let's mark it as SENT here since all others succeeded.
      if (!requestedChannels.includes(NotificationChannel.DATABASE)) {
        notification.status = NotificationStatus.SENT;
        await this.notificationRepository.save(notification);
      }
    } catch (err) {
      this.logger.error(`Failed to handle send job ${job.id}`, err);
      throw err;
    }
  }

  @Process('broadcast')
  async handleBroadcast(job: Job<BroadcastJobData>): Promise<void> {
    const {
      title,
      body,
      priority,
      channels,
      metadata,
      filterByRole,
      filterByPermission,
    } = job.data;
    this.logger.log(`Processing broadcast job ${job.id}: ${title}`);

    try {
      // Find all target users
      let query = this.userRepository
        .createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true });

      if (filterByRole) {
        query = query
          .innerJoin('user.roles', 'role')
          .andWhere('role.name = :roleName', { roleName: filterByRole });
      }

      const users = await query.getMany();
      this.logger.log(`Broadcast targeting ${users.length} active users.`);

      const jobPromises = users.map(async (user) => {
        // If filterByPermission is specified, check if user has that permission
        if (filterByPermission) {
          // Verify if user roles contain this permission
          // Note: Roles are eagerly loaded, but let's double check if we need to filter user-side
          const userPermissions = user.roles.flatMap(
            (r) => r.permissions || [],
          );
          if (!userPermissions.includes(filterByPermission)) {
            return;
          }
        }

        // Create the notification record in pending status for this user
        const notification = new NotificationEntity();
        notification.userId = user.id;
        notification.title = title;
        notification.body = body;
        notification.priority = priority;
        notification.channels = channels;
        notification.metadata = metadata;
        notification.status = NotificationStatus.PENDING;

        await this.notificationRepository.save(notification);

        // Enqueue individual send job
        await this.notificationsQueue.add(
          'send',
          {
            notificationId: notification.id,
            userId: user.id,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      });

      await Promise.all(jobPromises);
      this.logger.log(
        `Successfully enqueued send jobs for broadcast ${job.id}`,
      );
    } catch (err) {
      this.logger.error(`Failed to handle broadcast job ${job.id}`, err);
      throw err;
    }
  }
}
