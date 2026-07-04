/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Permission, VehicleType, DeliveryStopType } from '@futurefarm/types';
import { AppModule } from './../src/app.module';
import { VehicleEntity } from '../src/modules/logistics/entities/vehicle.entity';
import { DeliveryRunEntity } from '../src/modules/logistics/entities/delivery-run.entity';
import { DeliveryStopEntity } from '../src/modules/logistics/entities/delivery-stop.entity';
import { DriverLocationEntity } from '../src/modules/logistics/entities/driver-location.entity';
import { OrderLineEntity } from '../src/modules/orders/entities/order-line.entity';
import { InspectionReportEntity } from '../src/modules/inspections/entities/inspection-report.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { SeedService } from '../src/database/seed.service';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { getQueueToken } from '@nestjs/bull';
import { DataSource } from 'typeorm';

describe('LogisticsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn((entityOrClass: any, maybeEntity?: any) => {
      const entity = maybeEntity ?? entityOrClass;
      return Promise.resolve({ id: 'saved-id', ...entity });
    }),
    create: jest.fn((entityOrClass: any, maybeEntity?: any) => {
      const entity = maybeEntity ?? entityOrClass;
      return entity;
    }),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockVehicleRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((e) => Promise.resolve({ id: 'vehicle-123', ...e })),
  };

  const mockRunRepo = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    save: jest.fn((e) => Promise.resolve({ id: 'run-123', ...e })),
  };

  const mockStopRepo = {
    findOne: jest.fn(),
    save: jest.fn((e) => Promise.resolve({ id: 'stop-123', ...e })),
  };

  const mockLocationRepo = {
    create: jest.fn((e) => e),
    save: jest.fn((e) => Promise.resolve({ id: 'loc-123', ...e })),
    findOne: jest.fn(),
  };

  const mockOrderLineRepo = {
    update: jest.fn(),
  };

  const mockInspectionReportRepo = {
    findOne: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    client: { on: jest.fn() },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(getRepositoryToken(VehicleEntity))
      .useValue(mockVehicleRepo)
      .overrideProvider(getRepositoryToken(DeliveryRunEntity))
      .useValue(mockRunRepo)
      .overrideProvider(getRepositoryToken(DeliveryStopEntity))
      .useValue(mockStopRepo)
      .overrideProvider(getRepositoryToken(DriverLocationEntity))
      .useValue(mockLocationRepo)
      .overrideProvider(getRepositoryToken(OrderLineEntity))
      .useValue(mockOrderLineRepo)
      .overrideProvider(getRepositoryToken(InspectionReportEntity))
      .useValue(mockInspectionReportRepo)
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
    await app.close();
  });

  const getAuthHeader = (permissions: Permission[], userId = 'user-123') => {
    const token = jwtService.sign({
      sub: userId,
      email: 'driver@futurefarm.local',
      permissions,
    });
    return `Bearer ${token}`;
  };

  describe('GET /v1/logistics/vehicles', () => {
    it('should block request without VEHICLE_READ permission', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'driver@futurefarm.local',
        isActive: true,
        roles: [],
      });

      await request(app.getHttpServer() as any)
        .get('/v1/logistics/vehicles')
        .set('Authorization', getAuthHeader([]))
        .expect(403);
    });

    it('should return vehicles if authorized', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'driver@futurefarm.local',
        isActive: true,
        roles: [
          {
            name: 'Driver',
            permissions: [Permission.VEHICLE_READ],
          },
        ],
      });
      mockVehicleRepo.find.mockResolvedValue([
        { id: 'v-1', registrationPlate: 'AB-123-CD', type: VehicleType.TRUCK },
      ]);

      const res = await request(app.getHttpServer() as any)
        .get('/v1/logistics/vehicles')
        .set('Authorization', getAuthHeader([Permission.VEHICLE_READ]))
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data[0].registrationPlate).toBe('AB-123-CD');
    });
  });

  describe('POST /v1/logistics/runs', () => {
    it('should create a delivery run', async () => {
      const dto = {
        scheduledAt: new Date().toISOString(),
        stops: [
          { orderLineId: 'ol-1', type: DeliveryStopType.COLLECTION, address: { street: 'Main St', city: 'Metropolis', lat: 0, lon: 0 } },
        ],
      };

      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'driver@futurefarm.local',
        isActive: true,
        roles: [
          {
            name: 'Admin',
            permissions: [Permission.DELIVERY_RUN_CREATE],
          },
        ],
      });
      mockRunRepo.findOne.mockResolvedValue({
        id: 'run-123',
        stops: [],
      });

      const res = await request(app.getHttpServer() as any)
        .post('/v1/logistics/runs')
        .set('Authorization', getAuthHeader([Permission.DELIVERY_RUN_CREATE]))
        .send(dto)
        .expect(201);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /v1/logistics/location', () => {
    it('should record driver GPS ping', async () => {
      const dto = {
        runId: 'run-123',
        lat: 48.8566,
        lon: 2.3522,
        heading: 180,
        speedKmh: 50,
      };

      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'driver@futurefarm.local',
        isActive: true,
        roles: [
          {
            name: 'Driver',
            permissions: [Permission.DRIVER_LOCATION_PUSH],
          },
        ],
      });
      mockRunRepo.findOne.mockResolvedValue({ id: 'run-123', vehicleId: null });

      const res = await request(app.getHttpServer() as any)
        .post('/v1/logistics/location')
        .set('Authorization', getAuthHeader([Permission.DRIVER_LOCATION_PUSH]))
        .send(dto)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.lat).toBe(dto.lat);
    });
  });
});
