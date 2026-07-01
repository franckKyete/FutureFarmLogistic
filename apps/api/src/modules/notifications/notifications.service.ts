import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindManyOptions } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import type { PaginatedResult } from '@futurefarm/types';
import { NotificationStatus } from '@futurefarm/types';

import { NotificationEntity } from './entities/notification.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { UserEntity } from '../users/entities/user.entity';

import { SendNotificationDto } from './dto/send-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterPushSubscriptionDto } from './dto/register-push-subscription.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(PushSubscriptionEntity)
    private readonly pushSubscriptionRepository: Repository<PushSubscriptionEntity>,
    @InjectRepository(NotificationPreferencesEntity)
    private readonly preferencesRepository: Repository<NotificationPreferencesEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async send(dto: SendNotificationDto): Promise<void> {
    const { recipientIds, title, body, channels, priority, metadata } = dto;

    for (const userId of recipientIds) {
      const userExists = await this.userRepository.existsBy({ id: userId });
      if (!userExists) {
        this.logger.warn(`Recipient user ${userId} not found. Skipping send.`);
        continue;
      }

      // Create a pending notification row
      const notification = new NotificationEntity();
      notification.userId = userId;
      notification.title = title;
      notification.body = body;
      notification.channels = channels;
      notification.priority = priority ?? notification.priority;
      notification.metadata = metadata ?? null;
      notification.status = NotificationStatus.PENDING;

      const saved = await this.notificationRepository.save(notification);

      // Enqueue send job
      await this.notificationsQueue.add(
        'send',
        {
          notificationId: saved.id,
          userId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    }
  }

  async broadcast(dto: BroadcastNotificationDto): Promise<void> {
    // Enqueue the broadcast job itself, letting the processor resolve users asynchronously
    await this.notificationsQueue.add(
      'broadcast',
      {
        title: dto.title,
        body: dto.body,
        priority: dto.priority ?? 'normal',
        channels: dto.channels,
        metadata: dto.metadata ?? null,
        filterByRole: dto.filterByRole,
        filterByPermission: dto.filterByPermission,
      },
      {
        attempts: 1, // Only try the broadcast orchestration once
      },
    );
  }

  async getMyNotifications(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<NotificationEntity>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countBy({
      userId,
      readAt: IsNull(),
    });
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOneBy({
      id,
      userId,
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found.`);
    }

    if (notification.readAt === null) {
      notification.readAt = new Date();
      notification.status = NotificationStatus.READ;
      return this.notificationRepository.save(notification);
    }

    return notification;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    );
  }

  async deleteOwn(userId: string, id: string): Promise<void> {
    const notification = await this.notificationRepository.findOneBy({
      id,
      userId,
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found.`);
    }
    await this.notificationRepository.remove(notification);
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesEntity> {
    let prefs = await this.preferencesRepository.findOneBy({ userId });
    if (!prefs) {
      prefs = new NotificationPreferencesEntity();
      prefs.userId = userId;
      prefs.emailEnabled = true;
      prefs.smsEnabled = true;
      prefs.databaseEnabled = true;
      prefs.pushEnabled = true;
      prefs.whatsappEnabled = true;
      prefs = await this.preferencesRepository.save(prefs);
    }
    return prefs;
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferencesEntity> {
    const prefs = await this.getPreferences(userId);

    if (dto.email !== undefined) prefs.emailEnabled = dto.email;
    if (dto.sms !== undefined) prefs.smsEnabled = dto.sms;
    if (dto.database !== undefined) prefs.databaseEnabled = dto.database;
    if (dto.push !== undefined) prefs.pushEnabled = dto.push;
    if (dto.whatsapp !== undefined) prefs.whatsappEnabled = dto.whatsapp;

    return this.preferencesRepository.save(prefs);
  }

  async registerPushSubscription(
    userId: string,
    dto: RegisterPushSubscriptionDto,
  ): Promise<PushSubscriptionEntity> {
    let sub = await this.pushSubscriptionRepository.findOneBy({
      endpoint: dto.endpoint,
    });

    if (sub) {
      sub.userId = userId;
      sub.p256dh = dto.p256dh;
      sub.auth = dto.auth;
      sub.userAgent = dto.userAgent ?? null;
    } else {
      sub = new PushSubscriptionEntity();
      sub.userId = userId;
      sub.endpoint = dto.endpoint;
      sub.p256dh = dto.p256dh;
      sub.auth = dto.auth;
      sub.userAgent = dto.userAgent ?? null;
    }

    return this.pushSubscriptionRepository.save(sub);
  }

  async deletePushSubscription(
    userId: string,
    endpoint: string,
  ): Promise<void> {
    const sub = await this.pushSubscriptionRepository.findOneBy({ endpoint });
    if (!sub) {
      throw new NotFoundException(`Push subscription not found.`);
    }
    if (sub.userId !== userId) {
      throw new ForbiddenException(`You do not own this push subscription.`);
    }
    await this.pushSubscriptionRepository.remove(sub);
  }

  async getAllNotificationsAdmin(
    query: PaginationQueryDto,
    userId?: string,
    status?: NotificationStatus,
  ): Promise<PaginatedResult<NotificationEntity>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const findOptions: FindManyOptions<NotificationEntity> = {
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      where: {},
    };

    if (userId) {
      findOptions.where = { ...findOptions.where, userId };
    }
    if (status) {
      findOptions.where = { ...findOptions.where, status };
    }

    const [data, total] =
      await this.notificationRepository.findAndCount(findOptions);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async deleteNotificationAdmin(id: string): Promise<void> {
    const notification = await this.notificationRepository.findOneBy({ id });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found.`);
    }
    await this.notificationRepository.remove(notification);
  }
}
