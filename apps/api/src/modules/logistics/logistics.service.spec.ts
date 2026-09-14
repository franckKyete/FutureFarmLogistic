import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  DeliveryStopType,
  OrderLineStatus,
} from '@futurefarm/types';
import { LogisticsService } from './logistics.service';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { DriverLocationEntity } from './entities/driver-location.entity';
import { PickupReportEntity } from './entities/pickup-report.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { VehiclesService } from './vehicles.service';
import { ROUTE_OPTIMIZER_PORT } from './interfaces/route-optimizer.port';
import { STORAGE_PORT } from './interfaces/storage.port';
import { NotificationsService } from '../notifications/notifications.service';

describe('LogisticsService', () => {
  let service: LogisticsService;
  let runRepo: any;
  let stopRepo: any;
  let orderLineRepo: any;
  let driverLocationRepo: any;
  let pickupReportRepo: any;

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
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockEntityManager)),
  };

  const mockRouteOptimizer = {
    optimise: jest.fn((waypoints: any[]) =>
      Promise.resolve({
        orderedWaypoints: waypoints.map((wp: any, i: number) => ({ ...wp, originalIndex: i })),
        totalDistanceKm: 15.5,
        totalDurationSec: 900,
      }),
    ),
    table: jest.fn(() => Promise.resolve([[0, 10], [10, 0]])),
  };

  const mockStorage = {
    upload: jest.fn(() => Promise.resolve('https://s3.local/proof.jpg')),
    delete: jest.fn(() => Promise.resolve()),
  };

  const mockVehiclesService = {
    findOne: jest.fn(),
    updatePosition: jest.fn(),
  };

  const mockLogisticsGateway = {
    emitRunStatusUpdate: jest.fn(),
    emitStopStatusUpdate: jest.fn(),
    emitLocationUpdate: jest.fn(),
    emitRunAssigned: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogisticsService,
        {
          provide: getRepositoryToken(DeliveryRunEntity),
          useValue: { findOne: jest.fn(), findAndCount: jest.fn(), find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryStopEntity),
          useValue: { findOne: jest.fn(), save: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(DriverLocationEntity),
          useValue: { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ id: 'ping-id', ...x })), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(OrderLineEntity),
          useValue: { update: jest.fn() },
        },
        {
          provide: getRepositoryToken(PickupReportEntity),
          useValue: { findOne: jest.fn(), save: jest.fn((x) => Promise.resolve({ id: 'rep-123', ...x })), create: jest.fn((x) => x) },
        },
        {
          provide: VehiclesService,
          useValue: mockVehiclesService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ROUTE_OPTIMIZER_PORT,
          useValue: mockRouteOptimizer,
        },
        {
          provide: STORAGE_PORT,
          useValue: mockStorage,
        },
        {
          provide: 'LOGISTICS_GATEWAY',
          useValue: mockLogisticsGateway,
        },
        {
          provide: NotificationsService,
          useValue: {
            send: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<LogisticsService>(LogisticsService);
    runRepo = module.get(getRepositoryToken(DeliveryRunEntity));
    stopRepo = module.get(getRepositoryToken(DeliveryStopEntity));
    orderLineRepo = module.get(getRepositoryToken(OrderLineEntity));
    driverLocationRepo = module.get(getRepositoryToken(DriverLocationEntity));
    pickupReportRepo = module.get(getRepositoryToken(PickupReportEntity));

    stopRepo.save.mockImplementation((x: any) => Promise.resolve(x));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('run creation and retrieval', () => {
    it('should create a delivery run with stops and auto-generate pickup reports for COLLECTION stops', async () => {
      const dto = {
        scheduledAt: '2025-06-01T10:00:00Z',
        stops: [
          {
            orderLineId: 'ol-1',
            type: DeliveryStopType.COLLECTION,
            address: { street: 'Main St', city: 'City', lat: 10, lon: 20 },
          },
          {
            orderLineId: 'ol-2',
            type: DeliveryStopType.DELIVERY,
            address: { street: 'Second St', city: 'City', lat: 10.1, lon: 20.1 },
          },
        ],
      };

      runRepo.findOne.mockResolvedValue({ id: 'saved-id', ...dto, stops: [] });
      mockEntityManager.findOne.mockResolvedValue({ id: 'saved-id', ...dto, stops: [] });

      const result = await service.createRun(dto);
      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('run assignments', () => {
    it('should assign a driver and emit run:assigned', async () => {
      const run = {
        id: 'run-1',
        status: DeliveryRunStatus.PLANNED,
        scheduledAt: new Date(),
        stops: [{ address: { city: 'Dakar' } }, { address: { city: 'Thies' } }],
      };
      runRepo.findOne.mockResolvedValue(run);
      runRepo.save.mockResolvedValue({ ...run, driverId: 'driver-1' });

      const result = await service.assignDriver('run-1', 'driver-1');
      expect(result.driverId).toBe('driver-1');
      expect(mockLogisticsGateway.emitRunAssigned).toHaveBeenCalled();
    });

    it('should assign a vehicle to a planned run', async () => {
      const run = { id: 'run-1', status: DeliveryRunStatus.PLANNED };
      runRepo.findOne.mockResolvedValue(run);
      mockVehiclesService.findOne.mockResolvedValue({ id: 'veh-1' });
      runRepo.save.mockResolvedValue({ ...run, vehicleId: 'veh-1' });

      const result = await service.assignVehicle('run-1', 'veh-1');
      expect(result.vehicleId).toBe('veh-1');
    });
  });

  describe('run lifecycle', () => {
    it('should start a run when driver is assigned', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);
      mockEntityManager.findOne.mockResolvedValue(run);

      const result = await service.startRun('run-1', 'driver-1');
      expect(result.status).toBe(DeliveryRunStatus.IN_PROGRESS);
      expect(mockLogisticsGateway.emitRunStatusUpdate).toHaveBeenCalledWith('run-1', DeliveryRunStatus.IN_PROGRESS);
    });

    it('should reject start if caller is not the driver', async () => {
      const run = { id: 'run-1', driverId: 'driver-2', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);

      await expect(service.startRun('run-1', 'driver-1')).rejects.toThrow(ForbiddenException);
    });

    it('should cancel a run', async () => {
      const run = { id: 'run-1', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);
      mockEntityManager.findOne.mockResolvedValue(run);

      const result = await service.cancelRun('run-1');
      expect(result.status).toBe(DeliveryRunStatus.CANCELLED);
      expect(mockLogisticsGateway.emitRunStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('stop lifecycle gates', () => {
    it('should block completing stop if proof photo is missing', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', runId: 'run-1', type: DeliveryStopType.DELIVERY, status: DeliveryStopStatus.ARRIVED, proofPhotoUrl: null };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);

      await expect(service.completeStop('run-1', 'stop-1', 'driver-1')).rejects.toThrow(BadRequestException);
    });

    it('should block completing COLLECTION stop if pickup report is not SUBMITTED', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = {
        id: 'stop-1',
        runId: 'run-1',
        type: DeliveryStopType.COLLECTION,
        status: DeliveryStopStatus.ARRIVED,
        proofPhotoUrl: 'https://photo.jpg',
        pickupReportId: 'rep-1',
      };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      pickupReportRepo.findOne.mockResolvedValue({ id: 'rep-1', status: 'PENDING' });

      await expect(service.completeStop('run-1', 'stop-1', 'driver-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow completing COLLECTION stop if photo and submitted pickup report exist', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = {
        id: 'stop-1',
        runId: 'run-1',
        type: DeliveryStopType.COLLECTION,
        status: DeliveryStopStatus.ARRIVED,
        proofPhotoUrl: 'https://photo.jpg',
        pickupReportId: 'rep-1',
      };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      pickupReportRepo.findOne.mockResolvedValue({ id: 'rep-1', status: 'SUBMITTED' });
      stopRepo.save.mockResolvedValue({ ...stop, status: DeliveryStopStatus.COMPLETED });

      const result = await service.completeStop('run-1', 'stop-1', 'driver-1');
      expect(result.status).toBe(DeliveryStopStatus.COMPLETED);
    });

    it('should propagate DELIVERED status to order lines on DELIVERY stop completion', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = {
        id: 'stop-1',
        runId: 'run-1',
        type: DeliveryStopType.DELIVERY,
        status: DeliveryStopStatus.ARRIVED,
        proofPhotoUrl: 'https://photo.jpg',
        orderLineId: 'ol-1',
      };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      stopRepo.save.mockResolvedValue({ ...stop, status: DeliveryStopStatus.COMPLETED });

      await service.completeStop('run-1', 'stop-1', 'driver-1');
      expect(orderLineRepo.update).toHaveBeenCalledWith('ol-1', { status: OrderLineStatus.DELIVERED });
    });

    it('should submit pickup report successfully', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', runId: 'run-1', type: DeliveryStopType.COLLECTION, status: DeliveryStopStatus.ARRIVED, pickupReportId: 'rep-1' };
      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      pickupReportRepo.findOne.mockResolvedValue({ id: 'rep-1', status: 'PENDING' });

      const result = await service.submitPickupReport('run-1', 'stop-1', 'driver-1', {
        quantityVerified: true,
        conditionOk: 'GOOD' as any,
        packagingIntact: true,
        weightActualKg: 42,
      });

      expect(result.status).toBe('SUBMITTED');
    });
  });

  describe('proof photo and locations', () => {
    it('should upload proof photo and update stop URL', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', type: DeliveryStopType.DELIVERY, status: DeliveryStopStatus.ARRIVED };
      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      mockEntityManager.findOne.mockResolvedValueOnce(run).mockResolvedValueOnce(stop);

      const result = await service.uploadProofPhoto('run-1', 'stop-1', 'driver-1', Buffer.from(''), 'file.jpg', 'image/jpeg');
      expect(result.proofPhotoUrl).toBe('https://s3.local/proof.jpg');
    });

    it('should push GPS locations and trigger vehicle position update', async () => {
      const run = { id: 'run-1', vehicleId: 'veh-1' };
      runRepo.findOne.mockResolvedValue(run);

      const result = await service.pushLocation('driver-1', { runId: 'run-1', lat: 34.5, lon: -118.2 });
      expect(result!.lat).toBe(34.5);
      expect(mockVehiclesService.updatePosition).toHaveBeenCalledWith('veh-1', 34.5, -118.2);
    });

    it('should retrieve last driver location', async () => {
      driverLocationRepo.findOne.mockResolvedValue({ id: 'loc-1', lat: 34.5 });
      const result = await service.getLastLocation('run-1');
      expect(result!.lat).toBe(34.5);
    });
  });
});
