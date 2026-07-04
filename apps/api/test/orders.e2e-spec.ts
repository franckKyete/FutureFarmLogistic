/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bull';
import { DataSource } from 'typeorm';

import {
  Permission,
  HarvestStatus,
} from '@futurefarm/types';
import { AppModule } from '../src/app.module';
import { OrderEntity } from '../src/modules/orders/entities/order.entity';
import { OrderLineEntity } from '../src/modules/orders/entities/order-line.entity';
import { BasketEntity } from '../src/modules/orders/entities/basket.entity';
import { BasketLineEntity } from '../src/modules/orders/entities/basket-line.entity';
import { PaymentRecordEntity } from '../src/modules/orders/entities/payment-record.entity';
import { HarvestEntity } from '../src/modules/products/entities/harvest.entity';
import { FarmerProfileEntity } from '../src/modules/users/entities/farmer-profile.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { SeedService } from '../src/database/seed.service';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Orders & Baskets (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockOrderRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockOrderLineRepo = {
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockBasketRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockBasketLineRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockPaymentRecordRepo = {
    save: jest.fn(),
  };

  const mockHarvestRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockFarmerProfileRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    existsBy: jest.fn().mockResolvedValue(true),
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
      .overrideProvider(getRepositoryToken(OrderEntity))
      .useValue(mockOrderRepo)
      .overrideProvider(getRepositoryToken(OrderLineEntity))
      .useValue(mockOrderLineRepo)
      .overrideProvider(getRepositoryToken(BasketEntity))
      .useValue(mockBasketRepo)
      .overrideProvider(getRepositoryToken(BasketLineEntity))
      .useValue(mockBasketLineRepo)
      .overrideProvider(getRepositoryToken(PaymentRecordEntity))
      .useValue(mockPaymentRecordRepo)
      .overrideProvider(getRepositoryToken(HarvestEntity))
      .useValue(mockHarvestRepo)
      .overrideProvider(getRepositoryToken(FarmerProfileEntity))
      .useValue(mockFarmerProfileRepo)
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(NotificationsService)
      .useValue({
        send: jest.fn().mockResolvedValue([]),
      })
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

    const dataSourceObj = moduleFixture.get<DataSource>(DataSource);
    jest
      .spyOn(dataSourceObj, 'transaction')
      .mockImplementation((modeOrFactory: any, factory?: any) => {
        const executionFactory =
          typeof modeOrFactory === 'function' ? modeOrFactory : factory;
        return executionFactory(mockEntityManager);
      });

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/basket', () => {
    it('should return basket successfully for authenticated buyer', async () => {
      const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const token = jwtService.sign({ sub: buyerId, email: 'buyer@test.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: buyerId,
        isActive: true,
        roles: [{ permissions: [Permission.BASKET_MANAGE] }],
      });

      const mockBasket = { id: 'basket-1', buyerId: buyerId, status: 'ACTIVE', lines: [] };
      mockBasketRepo.findOne.mockResolvedValue(mockBasket);

      const res = await request(app.getHttpServer())
        .get('/v1/basket')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe('basket-1');
    });

    it('should return 403 if user lacks basket:manage permission', async () => {
      const token = jwtService.sign({ sub: 'buyer-id', email: 'buyer@test.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'buyer-id',
        isActive: true,
        roles: [{ permissions: [] }],
      });

      await request(app.getHttpServer())
        .get('/v1/basket')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('POST /v1/basket/checkout', () => {
    it('should checkout successfully and create an order', async () => {
      const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const token = jwtService.sign({ sub: buyerId, email: 'buyer@test.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: buyerId,
        isActive: true,
        roles: [{ permissions: [Permission.ORDER_CREATE] }],
      });

      const mockBasket = {
        id: 'basket-1',
        buyerId: buyerId,
        status: 'ACTIVE',
        lines: [{ id: 'line-1', harvestId: 'harvest-1', quantity: 10 }],
      };

      const mockHarvest = {
        id: 'harvest-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
        farmerProfileId: 'farmer-1',
      };

      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === BasketEntity) return Promise.resolve(mockBasket);
        if (entityClass === HarvestEntity) return Promise.resolve(mockHarvest);
        return Promise.resolve(null);
      });

      mockHarvestRepo.findOne.mockResolvedValue(mockHarvest);

      mockEntityManager.save.mockImplementation((entityClass, data) => {
        const entity = data ?? entityClass;
        return Promise.resolve({ id: 'saved-id', ...entity });
      });

      const res = await request(app.getHttpServer())
        .post('/v1/basket/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          deliveryAddress: {
            street: '123 Farm Road',
            city: 'Agricity',
            country: 'Morocco',
            postalCode: '40000',
          },
        })
        .expect(201);

      expect(res.body.data.id).toBe('saved-id');
      expect(res.body.data.buyerId).toBe(buyerId);
    });
  });
});
