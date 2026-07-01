import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { RoleEntity } from '../src/modules/roles/entities/role.entity';
import { FarmerProfileEntity } from '../src/modules/users/entities/farmer-profile.entity';
import { BuyerProfileEntity } from '../src/modules/users/entities/buyer-profile.entity';
import { ParcelEntity } from '../src/modules/users/entities/parcel.entity';
import { JwtService } from '@nestjs/jwt';
import { BuyerBusinessType, Permission } from '@futurefarm/types';
import { SeedService } from '../src/database/seed.service';
import { getQueueToken } from '@nestjs/bull';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRoleRepo = {
    findOneBy: jest.fn(),
  };

  const mockFarmerProfileRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBuyerProfileRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockParcelRepo = {
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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
      .overrideProvider(getRepositoryToken(RoleEntity))
      .useValue(mockRoleRepo)
      .overrideProvider(getRepositoryToken(FarmerProfileEntity))
      .useValue(mockFarmerProfileRepo)
      .overrideProvider(getRepositoryToken(BuyerProfileEntity))
      .useValue(mockBuyerProfileRepo)
      .overrideProvider(getRepositoryToken(ParcelEntity))
      .useValue(mockParcelRepo)
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

  describe('POST /v1/users/register/farmer', () => {
    it('should validate inputs and return 201', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockRoleRepo.findOneBy.mockResolvedValue({
        id: 'role-id',
        name: 'Farmer',
      });
      mockUserRepo.create.mockReturnValue({ id: 'user-id' });
      mockUserRepo.save.mockResolvedValue({ id: 'user-id' });
      mockFarmerProfileRepo.create.mockReturnValue({});
      mockFarmerProfileRepo.save.mockResolvedValue({});

      await request(app.getHttpServer())
        .post('/v1/users/register/farmer')
        .send({
          email: 'farmer@example.com',
          password: 'password123',
          firstName: 'Farmer',
          lastName: 'Bob',
          companyName: 'Farm Inc',
          address: '123 Farm Rd',
        })
        .expect(201);
    });
  });

  describe('POST /v1/users/register/buyer', () => {
    it('should validate inputs and return 201', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockRoleRepo.findOneBy.mockResolvedValue({
        id: 'role-id',
        name: 'Buyer',
      });
      mockUserRepo.create.mockReturnValue({ id: 'user-id' });
      mockUserRepo.save.mockResolvedValue({ id: 'user-id' });
      mockBuyerProfileRepo.create.mockReturnValue({});
      mockBuyerProfileRepo.save.mockResolvedValue({});

      await request(app.getHttpServer())
        .post('/v1/users/register/buyer')
        .send({
          email: 'buyer@example.com',
          password: 'password123',
          firstName: 'Buyer',
          lastName: 'Alice',
          companyName: 'Retail Co',
          vatNumber: 'FR123456789',
          businessType: BuyerBusinessType.RESTAURATEUR,
          billingAddress: '456 Bill St',
          shippingAddress: '456 Ship St',
        })
        .expect(201);
    });
  });

  describe('GET /v1/users', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/v1/users').expect(401);
    });

    it('should return 403 when user lacks permission', async () => {
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
        .get('/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return users list when user has user:read permission', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        isActive: true,
        roles: [{ name: 'Admin', permissions: [Permission.USER_READ] }],
      });
      mockUserRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
