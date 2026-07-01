/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { UserEntity } from '../users/entities/user.entity';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationChannel } from '@futurefarm/types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsQueue: any;
  let notificationRepository: any;
  let pushSubscriptionRepository: any;
  let preferencesRepository: any;
  let userRepository: any;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    countBy: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  const mockPushSubscriptionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };

  const mockPreferencesRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    existsBy: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(PushSubscriptionEntity),
          useValue: mockPushSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreferencesEntity),
          useValue: mockPreferencesRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationsQueue = module.get(getQueueToken('notifications'));
    notificationRepository = module.get(getRepositoryToken(NotificationEntity));
    pushSubscriptionRepository = module.get(
      getRepositoryToken(PushSubscriptionEntity),
    );
    preferencesRepository = module.get(
      getRepositoryToken(NotificationPreferencesEntity),
    );
    userRepository = module.get(getRepositoryToken(UserEntity));

    jest.clearAllMocks();

    mockQueue.add.mockReset();

    mockNotificationRepository.create.mockReset();
    mockNotificationRepository.save.mockReset();
    mockNotificationRepository.findAndCount.mockReset();
    mockNotificationRepository.countBy.mockReset();
    mockNotificationRepository.findOneBy.mockReset();
    mockNotificationRepository.update.mockReset();
    mockNotificationRepository.delete.mockReset();
    mockNotificationRepository.remove.mockReset();

    mockPushSubscriptionRepository.create.mockReset();
    mockPushSubscriptionRepository.save.mockReset();
    mockPushSubscriptionRepository.delete.mockReset();
    mockPushSubscriptionRepository.findOneBy.mockReset();
    mockPushSubscriptionRepository.remove.mockReset();

    mockPreferencesRepository.findOneBy.mockReset();
    mockPreferencesRepository.create.mockReset();
    mockPreferencesRepository.save.mockReset();

    mockUserRepository.existsBy.mockReset();
    mockUserRepository.find.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    const dto = {
      recipientIds: ['user-id'],
      title: 'Alert',
      body: 'Message',
      channels: [NotificationChannel.DATABASE],
      priority: NotificationPriority.NORMAL,
    };

    it('should skip sending if user does not exist', async () => {
      userRepository.existsBy.mockResolvedValue(false);
      await service.send(dto);
      expect(notificationRepository.save).not.toHaveBeenCalled();
      expect(notificationsQueue.add).not.toHaveBeenCalled();
    });

    it('should save notification and enqueue job if user exists', async () => {
      userRepository.existsBy.mockResolvedValue(true);
      notificationRepository.save.mockResolvedValue({ id: 'notif-id' });

      await service.send(dto);
      expect(notificationRepository.save).toHaveBeenCalled();
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        'send',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('broadcast', () => {
    const dto = {
      title: 'Alert',
      body: 'Message',
      channels: [NotificationChannel.DATABASE],
      priority: NotificationPriority.NORMAL,
    };

    it('should query targeted users and enqueue broadast job', async () => {
      userRepository.find.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);
      await service.broadcast(dto);
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        'broadcast',
        expect.objectContaining({
          title: 'Alert',
        }),
        expect.any(Object),
      );
    });
  });

  describe('inbox operations', () => {
    it('should list notifications', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.getMyNotifications('user-id', {
        page: 1,
        limit: 10,
      });
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should get unread count', async () => {
      notificationRepository.countBy.mockResolvedValue(5);
      const count = await service.getUnreadCount('user-id');
      expect(count).toBe(5);
    });

    it('should throw NotFoundException on markRead if notification not found', async () => {
      notificationRepository.findOneBy.mockResolvedValue(null);
      await expect(service.markRead('user-id', 'notif-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark notification as read', async () => {
      const mockNotif = { id: 'notif-id', userId: 'user-id', readAt: null };
      notificationRepository.findOneBy.mockResolvedValue(mockNotif);
      notificationRepository.save.mockResolvedValue({
        ...mockNotif,
        readAt: new Date(),
      });

      const result = await service.markRead('user-id', 'notif-id');
      expect(result.readAt).toBeDefined();
    });

    it('should mark all notifications as read', async () => {
      notificationRepository.update.mockResolvedValue({});
      await service.markAllRead('user-id');
      expect(notificationRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException on deleteOwn if not found', async () => {
      notificationRepository.findOneBy.mockResolvedValue(null);
      await expect(service.deleteOwn('user-id', 'notif-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete notification', async () => {
      const mockNotif = { id: 'notif-id', userId: 'user-id' };
      notificationRepository.findOneBy.mockResolvedValue(mockNotif);
      notificationRepository.remove.mockResolvedValue({});

      await service.deleteOwn('user-id', 'notif-id');
      expect(notificationRepository.remove).toHaveBeenCalledWith(mockNotif);
    });
  });

  describe('preferences', () => {
    it('should return preferences if they exist', async () => {
      const mockPrefs = { userId: 'user-id', emailEnabled: true };
      preferencesRepository.findOneBy.mockResolvedValue(mockPrefs);

      const result = await service.getPreferences('user-id');
      expect(result.emailEnabled).toBe(true);
    });

    it('should create default preferences if none exist', async () => {
      preferencesRepository.findOneBy.mockResolvedValue(null);
      preferencesRepository.create.mockReturnValue({
        userId: 'user-id',
        emailEnabled: true,
      });
      preferencesRepository.save.mockResolvedValue({
        userId: 'user-id',
        emailEnabled: true,
      });

      const result = await service.getPreferences('user-id');
      expect(result.emailEnabled).toBe(true);
    });

    it('should update preferences', async () => {
      const mockPrefs = { userId: 'user-id', emailEnabled: true };
      preferencesRepository.findOneBy.mockResolvedValue(mockPrefs);
      preferencesRepository.save.mockResolvedValue({
        userId: 'user-id',
        emailEnabled: false,
      });

      const result = await service.updatePreferences('user-id', {
        email: false,
      });
      expect(result.emailEnabled).toBe(false);
    });
  });

  describe('push subscriptions', () => {
    it('should register push subscription', async () => {
      const dto = {
        endpoint: 'https://...',
        p256dh: 'dhkey',
        auth: 'authkey',
        userAgent: 'chrome',
      };
      pushSubscriptionRepository.findOneBy.mockResolvedValue(null);
      pushSubscriptionRepository.create.mockReturnValue(dto);
      pushSubscriptionRepository.save.mockResolvedValue(dto);

      await service.registerPushSubscription('user-id', dto);
      expect(pushSubscriptionRepository.save).toHaveBeenCalled();
    });

    it('should unregister push subscription', async () => {
      const mockSub = {
        id: 'sub-id',
        userId: 'user-id',
        endpoint: 'https://...',
      };
      pushSubscriptionRepository.findOneBy.mockResolvedValue(mockSub);
      pushSubscriptionRepository.remove.mockResolvedValue({});

      await service.deletePushSubscription('user-id', 'https://...');
      expect(pushSubscriptionRepository.remove).toHaveBeenCalledWith(mockSub);
    });
  });
});
