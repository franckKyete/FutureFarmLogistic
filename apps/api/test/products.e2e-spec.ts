/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

import {
  Permission,
  HarvestStatus,
  HarvestUnit,
  ProductCategory,
} from '@futurefarm/types';
import { AppModule } from '../src/app.module';
import { ProductEntity } from '../src/modules/products/entities/product.entity';
import { HarvestEntity } from '../src/modules/products/entities/harvest.entity';
import { FarmerProfileEntity } from '../src/modules/users/entities/farmer-profile.entity';
import { ParcelEntity } from '../src/modules/users/entities/parcel.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { SeedService } from '../src/database/seed.service';
import { getQueueToken } from '@nestjs/bull';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockProductRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHarvestRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFarmerProfileRepo = {
    findOne: jest.fn(),
  };

  const mockParcelRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
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
      .overrideProvider(getRepositoryToken(ProductEntity))
      .useValue(mockProductRepo)
      .overrideProvider(getRepositoryToken(HarvestEntity))
      .useValue(mockHarvestRepo)
      .overrideProvider(getRepositoryToken(FarmerProfileEntity))
      .useValue(mockFarmerProfileRepo)
      .overrideProvider(getRepositoryToken(ParcelEntity))
      .useValue(mockParcelRepo)
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

  describe('POST /v1/products', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/v1/products')
        .send({})
        .expect(401);
    });

    it('should return 403 when user lacks product:create permission', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [],
      });

      await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Medjool', category: ProductCategory.DATES })
        .expect(403);
    });

    it('should return 201 and create product template successfully', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.PRODUCT_CREATE] }],
      });
      mockProductRepo.findOne.mockResolvedValue(null);
      mockProductRepo.create.mockReturnValue({
        name: 'Medjool',
        category: ProductCategory.DATES,
      });
      mockProductRepo.save.mockResolvedValue({
        id: 'prod-id',
        name: 'Medjool',
        category: ProductCategory.DATES,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Medjool', category: ProductCategory.DATES })
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'prod-id');
    });
  });

  describe('POST /v1/harvests', () => {
    it('should create a harvest listing for farmer', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [
          { permissions: [Permission.HARVEST_CREATE, Permission.PRODUCT_READ] },
        ],
      });
      mockFarmerProfileRepo.findOne.mockResolvedValue({
        id: 'farmer-id',
        userId: 'user-id',
      });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-id' });
      mockHarvestRepo.create.mockReturnValue({ id: 'harvest-id' });
      mockHarvestRepo.save.mockResolvedValue({
        id: 'harvest-id',
        status: HarvestStatus.PENDING_APPROVAL,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/harvests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: 'prod-id',
          harvestDate: '2026-07-01',
          expirationDate: '2026-08-01',
          quantityInStock: 100,
          pricePerUnit: 5.5,
          unit: HarvestUnit.KG,
          farmingMethods: 'Organic',
          photoUrls: [],
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'harvest-id');
    });
  });

  describe('GET /v1/harvests/:id/price', () => {
    it('should compute degressive price correctly', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.HARVEST_READ] }],
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      mockHarvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        pricePerUnit: 10.0,
        expirationDate: futureDate,
        priceDecayConfig: {
          decaySteps: [{ daysBeforeExpiration: 5, priceMultiplier: 0.8 }],
        },
      });

      const response = await request(app.getHttpServer())
        .get('/v1/harvests/harvest-id/price')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('basePrice', 10.0);
      expect(response.body.data).toHaveProperty('decayedPrice', 8.0);
      expect(response.body.data).toHaveProperty('multiplier', 0.8);
    });
  });

  describe('PATCH /v1/harvests/:id/verify', () => {
    it('should allow inspector to verify harvest batch', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'test@example.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.HARVEST_VERIFY] }],
      });

      mockHarvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        status: HarvestStatus.PENDING_APPROVAL,
      });
      mockHarvestRepo.save.mockImplementation((h: any) => Promise.resolve(h));

      const response = await request(app.getHttpServer())
        .patch('/v1/harvests/harvest-id/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: HarvestStatus.APPROVED,
          qualityScore: 9.0,
        })
        .expect(200);

      expect(response.body.data).toHaveProperty(
        'status',
        HarvestStatus.APPROVED,
      );
      expect(response.body.data).toHaveProperty('qualityScore', 9.0);
    });
  });
});
