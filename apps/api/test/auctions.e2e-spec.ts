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
  AuctionStatus,
  BidStatus,
  HarvestStatus,
} from '@futurefarm/types';
import { AppModule } from '../src/app.module';
import { AuctionEntity } from '../src/modules/auctions/entities/auction.entity';
import { BidEntity } from '../src/modules/auctions/entities/bid.entity';
import { HarvestEntity } from '../src/modules/products/entities/harvest.entity';
import { FarmerProfileEntity } from '../src/modules/users/entities/farmer-profile.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { SeedService } from '../src/database/seed.service';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('Auctions (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAuctionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBidRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
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
      .overrideProvider(getRepositoryToken(AuctionEntity))
      .useValue(mockAuctionRepo)
      .overrideProvider(getRepositoryToken(BidEntity))
      .useValue(mockBidRepo)
      .overrideProvider(getRepositoryToken(HarvestEntity))
      .useValue(mockHarvestRepo)
      .overrideProvider(getRepositoryToken(FarmerProfileEntity))
      .useValue(mockFarmerProfileRepo)
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

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    jest
      .spyOn(dataSource, 'transaction')
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

  describe('GET /v1/auctions', () => {
    it('should allow public access without authentication', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAuctionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await request(app.getHttpServer()).get('/v1/auctions').expect(200);
    });
  });

  describe('POST /v1/auctions', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/auctions')
        .send({
          harvestId: 'uuid',
          startingPrice: 100,
          reservePrice: 50,
          priceDecrementAmount: 5,
          priceDecrementIntervalMinutes: 10,
          startAt: '2026-07-04T18:00:00.000Z',
          endAt: '2026-07-05T18:00:00.000Z',
          quantityOnOffer: 50,
        })
        .expect(401);
    });

    it('should reject request missing auction:create permission with 403', async () => {
      const token = jwtService.sign({ sub: 'user-id', email: 'user@test.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [] }],
      });

      await request(app.getHttpServer())
        .post('/v1/auctions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          harvestId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          startingPrice: 100,
          reservePrice: 50,
          priceDecrementAmount: 5,
          priceDecrementIntervalMinutes: 10,
          startAt: '2026-07-04T18:00:00.000Z',
          endAt: '2026-07-05T18:00:00.000Z',
          quantityOnOffer: 50,
        })
        .expect(403);
    });

    it('should create auction successfully if authorized and input valid', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'farmer@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.AUCTION_CREATE] }],
      });

      mockFarmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1' });
      mockHarvestRepo.findOne.mockResolvedValue({
        id: 'harvest-1',
        farmerProfileId: 'farmer-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 200,
        stockMarge: 10,
      });
      mockAuctionRepo.findOne.mockResolvedValue(null);
      mockAuctionRepo.save.mockResolvedValue({
        id: 'auc-id-777',
        harvestId: 'harvest-1',
        status: AuctionStatus.SCHEDULED,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auctions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          harvestId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          startingPrice: 100,
          reservePrice: 50,
          priceDecrementAmount: 5,
          priceDecrementIntervalMinutes: 10,
          startAt: new Date(Date.now() + 3600000).toISOString(),
          endAt: new Date(Date.now() + 86400000).toISOString(),
          quantityOnOffer: 50,
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'auc-id-777');
    });
  });

  describe('POST /v1/auctions/:id/bids', () => {
    it('should place a bid and win active auction successfully', async () => {
      const token = jwtService.sign({
        sub: 'buyer-id',
        email: 'buyer@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'buyer-id',
        isActive: true,
        roles: [{ permissions: [Permission.BID_CREATE] }],
      });

      mockEntityManager.findOne.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ACTIVE,
        currentPrice: 85,
        quantityOnOffer: 30,
        farmerProfile: { userId: 'farmer-1' },
      });
      mockEntityManager.save.mockImplementation((x) => {
        if (x instanceof BidEntity || !x.status) {
          return Promise.resolve({
            id: 'bid-1',
            priceAtBid: 85,
            status: BidStatus.ACCEPTED,
            ...x,
          });
        }
        return Promise.resolve(x);
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auctions/auc-1/bids')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'bid-1');
      expect(response.body.data.priceAtBid).toBe(85);
    });
  });

  describe('GET /v1/auctions/my-bids', () => {
    it('should get caller own bids history', async () => {
      const token = jwtService.sign({
        sub: 'buyer-id',
        email: 'buyer@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'buyer-id',
        isActive: true,
        roles: [{ permissions: [Permission.BID_READ] }],
      });

      mockBidRepo.find.mockResolvedValue([
        { id: 'bid-1', priceAtBid: 90, status: BidStatus.ACCEPTED },
      ]);

      const response = await request(app.getHttpServer())
        .get('/v1/auctions/my-bids')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('id', 'bid-1');
    });
  });
});
