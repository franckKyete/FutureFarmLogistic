import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationEntity } from '../src/modules/notifications/entities/notification.entity';
import { PushSubscriptionEntity } from '../src/modules/notifications/entities/push-subscription.entity';
import { NotificationPreferencesEntity } from '../src/modules/notifications/entities/notification-preferences.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { getQueueToken } from '@nestjs/bull';
import { JwtService } from '@nestjs/jwt';
import {
  NotificationPriority,
  NotificationChannel,
  Permission,
} from '@futurefarm/types';
import { SeedService } from '../src/database/seed.service';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockNotificationRepo = {
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };

  const mockPushSubscriptionRepo = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPreferencesRepo = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    existsBy: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    client: {
      on: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(NotificationEntity))
      .useValue(mockNotificationRepo)
      .overrideProvider(getRepositoryToken(PushSubscriptionEntity))
      .useValue(mockPushSubscriptionRepo)
      .overrideProvider(getRepositoryToken(NotificationPreferencesEntity))
      .useValue(mockPreferencesRepo)
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(getQueueToken('notifications'))
      .useValue(mockQueue)
      .overrideProvider(SeedService)
      .useValue({
        onApplicationBootstrap: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/notifications', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).post('/v1/notifications').expect(401);
    });

    it('should return 403 when lacking notification:send permission', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        isActive: true,
        roles: [],
      });

      await request(app.getHttpServer())
        .post('/v1/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientIds: ['user-id'],
          title: 'Alert',
          body: 'Message',
          channels: [NotificationChannel.DATABASE],
          priority: NotificationPriority.NORMAL,
        })
        .expect(403);
    });

    it('should send notification and return 201 when authorized', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        isActive: true,
        roles: [
          {
            name: 'Admin',
            permissions: [Permission.NOTIFICATION_SEND],
          },
        ],
      });
      mockUserRepo.existsBy.mockResolvedValue(true);
      mockNotificationRepo.save.mockResolvedValue({ id: 'notif-id' });

      await request(app.getHttpServer())
        .post('/v1/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientIds: ['user-id'],
          title: 'Alert',
          body: 'Message',
          channels: [NotificationChannel.DATABASE],
          priority: NotificationPriority.NORMAL,
        })
        .expect(201);
    });
  });

  describe('GET /v1/notifications/me', () => {
    it('should return 200 and paginated inbox for authenticated user', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        isActive: true,
        roles: [
          {
            name: 'User',
            permissions: [Permission.NOTIFICATION_READ],
          },
        ],
      });
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/v1/notifications/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
