import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { RoleEntity } from '../src/modules/roles/entities/role.entity';
import { FarmerProfileEntity } from '../src/modules/users/entities/farmer-profile.entity';
import { ParcelEntity } from '../src/modules/users/entities/parcel.entity';
import { HarvestEntity } from '../src/modules/products/entities/harvest.entity';
import { ProductEntity } from '../src/modules/products/entities/product.entity';
import { AuctionEntity } from '../src/modules/auctions/entities/auction.entity';
import { InspectionCenterEntity } from '../src/modules/inspections/entities/inspection-center.entity';
import { InspectorCenterAssignmentEntity } from '../src/modules/inspections/entities/inspector-center-assignment.entity';
import { InspectorProfileEntity } from '../src/modules/inspections/entities/inspector-profile.entity';
import { JwtService } from '@nestjs/jwt';
import { Permission, HarvestStatus, AuctionStatus } from '@futurefarm/types';
import { SeedService } from '../src/database/seed.service';
import { getQueueToken } from '@nestjs/bull';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('Assisted Farming & Inspection Centers (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  // Mock repos
  const mockUserRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
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

  const mockParcelRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockHarvestRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProductRepo = {
    findOne: jest.fn(),
  };

  const mockAuctionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCenterRepo = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((c) => c),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockAssignmentRepo = {
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockInspectorProfileRepo = {
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
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(getRepositoryToken(RoleEntity))
      .useValue(mockRoleRepo)
      .overrideProvider(getRepositoryToken(FarmerProfileEntity))
      .useValue(mockFarmerProfileRepo)
      .overrideProvider(getRepositoryToken(ParcelEntity))
      .useValue(mockParcelRepo)
      .overrideProvider(getRepositoryToken(HarvestEntity))
      .useValue(mockHarvestRepo)
      .overrideProvider(getRepositoryToken(ProductEntity))
      .useValue(mockProductRepo)
      .overrideProvider(getRepositoryToken(AuctionEntity))
      .useValue(mockAuctionRepo)
      .overrideProvider(getRepositoryToken(InspectionCenterEntity))
      .useValue(mockCenterRepo)
      .overrideProvider(getRepositoryToken(InspectorCenterAssignmentEntity))
      .useValue(mockAssignmentRepo)
      .overrideProvider(getRepositoryToken(InspectorProfileEntity))
      .useValue(mockInspectorProfileRepo)
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

  const getTokens = (permissions: Permission[]) => {
    const payload = { sub: 'actor-id', email: 'actor@futurefarm.local' };
    mockUserRepo.findOne.mockResolvedValue({
      id: 'actor-id',
      email: 'actor@futurefarm.local',
      isActive: true,
      roles: [{ name: 'TestRole', permissions }],
    });
    return jwtService.sign(payload);
  };

  describe('Assisted Farmer Proxy CRUD', () => {
    it('should allow Inspector to register a farmer on their behalf', async () => {
      const token = getTokens([Permission.FARMER_PROXY_CREATE]);

      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockRoleRepo.findOneBy.mockResolvedValue({ id: 'role-id', name: 'Farmer' });
      mockUserRepo.create.mockImplementation((dto) => dto);
      mockUserRepo.save.mockImplementation((user) => Promise.resolve({ id: 'farmer-id', ...user }));
      mockFarmerProfileRepo.create.mockReturnValue({});
      mockFarmerProfileRepo.save.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/v1/users/register/farmer/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'offline-farmer@example.com',
          firstName: 'Offline',
          lastName: 'Farmer',
          companyName: 'NoInternet Farms',
          address: '456 Remote Road',
        })
        .expect(201);

      expect(response.body.data.email).toBe('offline-farmer@example.com');
      expect(response.body.data.temporaryPassword).toBeDefined();
      expect(response.body.data.createdByActorId).toBe('actor-id');
    });

    it('should allow Inspector to update a farmer profile and submit land parcel', async () => {
      const token = getTokens([Permission.FARMER_PROXY_UPDATE]);

      mockFarmerProfileRepo.findOne.mockResolvedValue({ id: 'profile-id', userId: 'farmer-id' });
      mockFarmerProfileRepo.save.mockImplementation((p) => Promise.resolve(p));

      await request(app.getHttpServer())
        .put('/v1/users/profile/farmer/farmer-id')
        .set('Authorization', `Bearer ${token}`)
        .send({
          companyName: 'Updated Farm Name',
          address: '789 Remote Road',
        })
        .expect(200);

      mockFarmerProfileRepo.findOneBy.mockResolvedValue({ id: 'profile-id' });
      mockParcelRepo.create.mockImplementation((p) => p);
      mockParcelRepo.save.mockImplementation((p) => Promise.resolve({ id: 'parcel-id', ...p }));

      const parcelRes = await request(app.getHttpServer())
        .post('/v1/users/farmer-id/parcels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cadastralNumber: 'CAD-12345',
          sizeHectares: 12.5,
          locationCoordinates: [1.23, 4.56],
          cropTypes: ['Apples'],
        })
        .expect(201);

      expect(parcelRes.body.data.cadastralNumber).toBe('CAD-12345');
    });
  });

  describe('Proxy Harvest Management', () => {
    it('should allow Inspector to create, update, and delete harvest on behalf of a farmer', async () => {
      const token = getTokens([Permission.FARMER_PROXY_HARVEST_MANAGE]);

      mockFarmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-profile-id' });
      mockProductRepo.findOne.mockResolvedValue({ id: 'product-id' });
      mockParcelRepo.findOne.mockResolvedValue({ id: 'parcel-id', farmerProfileId: 'farmer-profile-id' });
      mockHarvestRepo.create.mockImplementation((h) => h);
      mockHarvestRepo.save.mockImplementation((h) => Promise.resolve({ id: 'harvest-id', ...h }));

      const createRes = await request(app.getHttpServer())
        .post('/v1/harvests/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
          productId: 'product-id',
          parcelId: 'parcel-id',
          quantityInStock: 100,
          unit: 'kg',
          initialPricePerUnit: 5.5,
          decayRatePerHour: 0.1,
          minimumPricePerUnit: 2.0,
        })
        .expect(201);

      expect(createRes.body.data.farmerProfileId).toBe('farmer-profile-id');

      mockHarvestRepo.findOne.mockResolvedValue({ id: 'harvest-id', farmerProfileId: 'farmer-profile-id' });

      await request(app.getHttpServer())
        .patch('/v1/harvests/harvest-id/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
          quantityInStock: 80,
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete('/v1/harvests/harvest-id/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
        })
        .expect(200);
    });
  });

  describe('Proxy Auction Management', () => {
    it('should allow Inspector to create, update, and cancel auction on behalf of a farmer', async () => {
      const token = getTokens([Permission.FARMER_PROXY_AUCTION_MANAGE]);

      mockFarmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-profile-id' });
      mockHarvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        farmerProfileId: 'farmer-profile-id',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
      });

      const start = new Date(Date.now() + 600000);
      const end = new Date(Date.now() + 3600000);

      mockAuctionRepo.create.mockImplementation((a) => a);
      mockAuctionRepo.save.mockImplementation((a) => Promise.resolve({ id: 'auction-id', ...a }));

      const auctionRes = await request(app.getHttpServer())
        .post('/v1/auctions/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
          harvestId: 'harvest-id',
          startingPrice: 10,
          reservePrice: 5,
          priceDecrementAmount: 1,
          priceDecrementIntervalMinutes: 10,
          quantityOnOffer: 50,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        })
        .expect(201);

      expect(auctionRes.body.data.farmerProfileId).toBe('farmer-profile-id');

      mockAuctionRepo.findOne.mockResolvedValue({
        id: 'auction-id',
        farmerProfileId: 'farmer-profile-id',
        status: AuctionStatus.SCHEDULED,
      });

      await request(app.getHttpServer())
        .patch('/v1/auctions/auction-id/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
          startingPrice: 12,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auctions/auction-id/cancel/proxy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          farmerUserId: 'farmer-id',
        })
        .expect(200);
    });
  });

  describe('Inspection Centers Management', () => {
    it('should support full center CRUD and inspector assignments', async () => {
      const token = getTokens([
        Permission.INSPECTION_CENTER_CREATE,
        Permission.INSPECTION_CENTER_READ,
        Permission.INSPECTION_CENTER_UPDATE,
        Permission.INSPECTION_CENTER_DELETE,
        Permission.INSPECTION_CENTER_ASSIGN,
      ]);

      mockCenterRepo.findOne.mockResolvedValue(null);
      mockCenterRepo.save.mockImplementation((c) => Promise.resolve({ id: 'center-id', ...c }));

      const createRes = await request(app.getHttpServer())
        .post('/v1/inspection-centers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Central Inspection Point',
          code: 'CTR-ABI-001',
          regionName: 'Abidjan',
          address: 'Main St 10',
          latitude: 5.309,
          longitude: -4.012,
        })
        .expect(201);

      expect(createRes.body.data.code).toBe('CTR-ABI-001');

      mockCenterRepo.findOne.mockResolvedValue({ id: 'center-id', code: 'CTR-ABI-001', isActive: true });

      const getRes = await request(app.getHttpServer())
        .get('/v1/inspection-centers/center-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getRes.body.data.id).toBe('center-id');

      await request(app.getHttpServer())
        .patch('/v1/inspection-centers/center-id')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Central Center',
        })
        .expect(200);

      mockInspectorProfileRepo.findOne.mockResolvedValue({ id: 'inspector-profile-id' });
      mockAssignmentRepo.save.mockImplementation((a) => Promise.resolve({ id: 'assignment-id', ...a }));

      await request(app.getHttpServer())
        .post('/v1/inspection-centers/center-id/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inspectorProfileId: 'inspector-profile-id',
        })
        .expect(201);

      mockAssignmentRepo.find.mockResolvedValue([
        { inspectorProfile: { id: 'inspector-profile-id', user: { firstName: 'Inspector' } } },
      ]);

      const inspectsRes = await request(app.getHttpServer())
        .get('/v1/inspection-centers/center-id/inspectors')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(inspectsRes.body.data[0].id).toBe('inspector-profile-id');

      await request(app.getHttpServer())
        .delete('/v1/inspection-centers/center-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });
});
