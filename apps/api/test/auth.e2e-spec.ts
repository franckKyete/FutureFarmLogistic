/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserSessionEntity } from '../src/modules/auth/entities/user-session.entity';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, Permission } from '@futurefarm/types';
import { SeedService } from '../src/database/seed.service';
import { getQueueToken } from '@nestjs/bull';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockSessionRepo = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
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
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(getRepositoryToken(UserSessionEntity))
      .useValue(mockSessionRepo)
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

  describe('POST /v1/auth/login', () => {
    it('should return 401 on invalid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'wrong@example.com', password: 'password' })
        .expect(401);
    });

    it('should return tokens on successful login', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        status: UserStatus.APPROVED,
        isTwoFactorEnabled: false,
        roles: [],
        validatePassword: jest.fn().mockResolvedValue(true),
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockSessionRepo.save.mockResolvedValue({});

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.tokens).toBeDefined();
          expect(res.body.data.user.email).toBe('test@example.com');
        });
    });
  });

  describe('GET /v1/auth/sessions', () => {
    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/v1/auth/sessions').expect(401);
    });

    it('should return sessions list if authenticated', async () => {
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
            permissions: [Permission.SESSION_MANAGE],
          },
        ],
      });
      mockSessionRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });
});
