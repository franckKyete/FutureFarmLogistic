/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Job } from 'bull';
import {
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { UserEntity } from '../users/entities/user.entity';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { DatabaseChannel } from './channels/database.channel';
import { PushChannel } from './channels/push.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let userRepo: any;
  let notificationRepo: any;
  let preferencesRepo: any;
  let queue: any;
  let emailChannel: any;
  let smsChannel: any;

  const mockQueue = {
    add: jest.fn(() => Promise.resolve()),
  };

  const mockEmailChannel = {
    send: jest.fn(() => Promise.resolve()),
  };

  const mockSmsChannel = {
    send: jest.fn(() => Promise.resolve()),
  };

  const mockDatabaseChannel = {
    send: jest.fn(() => Promise.resolve()),
  };

  const mockPushChannel = {
    send: jest.fn(() => Promise.resolve()),
  };

  const mockWhatsappChannel = {
    send: jest.fn(() => Promise.resolve()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: { save: jest.fn((x) => Promise.resolve({ id: 'saved-id', ...x })), findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(NotificationPreferencesEntity),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: { findOneBy: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: EmailChannel,
          useValue: mockEmailChannel,
        },
        {
          provide: SmsChannel,
          useValue: mockSmsChannel,
        },
        {
          provide: DatabaseChannel,
          useValue: mockDatabaseChannel,
        },
        {
          provide: PushChannel,
          useValue: mockPushChannel,
        },
        {
          provide: WhatsAppChannel,
          useValue: mockWhatsappChannel,
        },
      ],
    }).compile();

    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
    userRepo = module.get(getRepositoryToken(UserEntity));
    notificationRepo = module.get(getRepositoryToken(NotificationEntity));
    preferencesRepo = module.get(getRepositoryToken(NotificationPreferencesEntity));
    queue = module.get(getQueueToken('notifications'));
    emailChannel = module.get(EmailChannel);
    smsChannel = module.get(SmsChannel);

    jest.clearAllMocks();
  });

  describe('handleSend', () => {
    it('should process send job and route to enabled channels', async () => {
      const mockUser = { id: 'user-1', email: 'user@farm.com', phoneNumber: '123' };
      const mockNotification = {
        id: 'notif-1',
        title: 'Title',
        body: 'Body',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
        metadata: null,
      };
      const mockPrefs = {
        userId: 'user-1',
        emailEnabled: true,
        smsEnabled: false, // SMS is disabled
        databaseEnabled: true,
        pushEnabled: true,
        whatsappEnabled: true,
      };

      userRepo.findOneBy.mockResolvedValue(mockUser);
      notificationRepo.findOneBy.mockResolvedValue(mockNotification);
      preferencesRepo.findOneBy.mockResolvedValue(mockPrefs);

      const mockJob = {
        id: 'job-1',
        data: { notificationId: 'notif-1', userId: 'user-1' },
      } as Job;

      await processor.handleSend(mockJob);

      expect(emailChannel.send).toHaveBeenCalled();
      expect(smsChannel.send).not.toHaveBeenCalled(); // due to preferences filter
      expect(notificationRepo.save).toHaveBeenCalled();
    });
  });

  describe('handleBroadcast', () => {
    it('should process broadcast job, filter users by role and enqueue individual send jobs', async () => {
      const mockUser1 = { id: 'user-1', isActive: true, roles: [{ name: 'Farmer', permissions: [] }] };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser1]),
      };
      userRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockJob = {
        id: 'job-2',
        data: {
          title: 'Broadcast',
          body: 'Hello Farmers',
          priority: NotificationPriority.NORMAL,
          channels: [NotificationChannel.EMAIL],
          metadata: null,
          filterByRole: 'Farmer',
        },
      } as Job;

      await processor.handleBroadcast(mockJob);

      expect(notificationRepo.save).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('send', expect.any(Object), expect.any(Object));
    });
  });
});
