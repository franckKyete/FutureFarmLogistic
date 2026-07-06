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
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { VehiclesService } from './vehicles.service';
import { ROUTE_OPTIMIZER_PORT } from './interfaces/route-optimizer.port';
import { STORAGE_PORT } from './interfaces/storage.port';

describe('LogisticsService', () => {
  let service: LogisticsService;
  let runRepo: any;
  let stopRepo: any;
  let orderLineRepo: any;
  let driverLocationRepo: any;
  let inspectionReportRepo: any;

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
          provide: getRepositoryToken(InspectionReportEntity),
          useValue: { findOne: jest.fn() },
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
      ],
    }).compile();

    service = module.get<LogisticsService>(LogisticsService);
    runRepo = module.get(getRepositoryToken(DeliveryRunEntity));
    stopRepo = module.get(getRepositoryToken(DeliveryStopEntity));
    orderLineRepo = module.get(getRepositoryToken(OrderLineEntity));
    driverLocationRepo = module.get(getRepositoryToken(DriverLocationEntity));
    inspectionReportRepo = module.get(getRepositoryToken(InspectionReportEntity));

    stopRepo.save.mockImplementation((x: any) => Promise.resolve(x));

    jest.clearAllMocks();
  });

  describe('createRun', () => {
    it('should create run and optimize stops using OSRM', async () => {
      const dto = {
        scheduledAt: new Date().toISOString(),
        stops: [
          { orderLineId: 'ol-1', type: DeliveryStopType.COLLECTION, address: { street: 'Farm A', city: 'Town', lat: 45, lon: 4 }, notes: '' },
          { orderLineId: 'ol-2', type: DeliveryStopType.DELIVERY, address: { street: 'Buyer B', city: 'Town', lat: 46, lon: 5 }, notes: '' },
        ],
      };

      runRepo.findOne.mockResolvedValue({ id: 'saved-id', stops: [] });
      const result = await service.createRun(dto);
      expect(result).toBeDefined();
      expect(mockRouteOptimizer.optimise).toHaveBeenCalled();
    });
  });

  describe('run lifecycle', () => {
    it('should start a planned run successfully', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);
      mockEntityManager.findOne.mockResolvedValue(run);

      const result = await service.startRun('run-1', 'driver-1');
      expect(result.status).toBe(DeliveryRunStatus.IN_PROGRESS);
      expect(mockLogisticsGateway.emitRunStatusUpdate).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if another driver tries to start a run', async () => {
      const run = { id: 'run-1', driverId: 'driver-2', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);
      mockEntityManager.findOne.mockResolvedValue(run);

      await expect(service.startRun('run-1', 'driver-1')).rejects.toThrow(ForbiddenException);
    });

    it('should cancel a delivery run successfully', async () => {
      const run = { id: 'run-1', status: DeliveryRunStatus.PLANNED, stops: [] };
      runRepo.findOne.mockResolvedValue(run);
      mockEntityManager.findOne.mockResolvedValue(run);

      const result = await service.cancelRun('run-1');
      expect(result.status).toBe(DeliveryRunStatus.CANCELLED);
      expect(mockLogisticsGateway.emitRunStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('stop lifecycle gates', () => {
    it('should block completing COLLECTION stop if pickup report is missing', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', runId: 'run-1', type: DeliveryStopType.COLLECTION, status: DeliveryStopStatus.ARRIVED, pickupReportId: null };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);

      await expect(service.completeStop('run-1', 'stop-1', 'driver-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow completing COLLECTION stop if pickup report exists', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', runId: 'run-1', type: DeliveryStopType.COLLECTION, status: DeliveryStopStatus.ARRIVED, pickupReportId: 'rep-123' };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      stopRepo.save.mockResolvedValue({ ...stop, status: DeliveryStopStatus.COMPLETED });

      const result = await service.completeStop('run-1', 'stop-1', 'driver-1');
      expect(result.status).toBe(DeliveryStopStatus.COMPLETED);
    });

    it('should propagate DELIVERED status to order lines on DELIVERY stop completion', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', runId: 'run-1', type: DeliveryStopType.DELIVERY, status: DeliveryStopStatus.ARRIVED, orderLineId: 'ol-1' };

      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      stopRepo.save.mockResolvedValue({ ...stop, status: DeliveryStopStatus.COMPLETED });

      await service.completeStop('run-1', 'stop-1', 'driver-1');
      expect(orderLineRepo.update).toHaveBeenCalledWith('ol-1', { status: OrderLineStatus.DELIVERED });
    });

    it('should arrive at stop successfully', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', status: DeliveryStopStatus.PENDING };
      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      mockEntityManager.findOne.mockResolvedValueOnce(run).mockResolvedValueOnce(stop);

      const result = await service.arriveAtStop('run-1', 'stop-1', 'driver-1');
      expect(result.status).toBe(DeliveryStopStatus.ARRIVED);
    });

    it('should skip a stop with reason', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', status: DeliveryStopStatus.PENDING };
      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      mockEntityManager.findOne.mockResolvedValueOnce(run).mockResolvedValueOnce(stop);

      const result = await service.skipStop('run-1', 'stop-1', 'driver-1', { reason: 'Road blocked' });
      expect(result.status).toBe(DeliveryStopStatus.SKIPPED);
      expect(result.skipReason).toBe('Road blocked');
    });

    it('should associate inspection report with stop', async () => {
      const run = { id: 'run-1', driverId: 'driver-1', status: DeliveryRunStatus.IN_PROGRESS, stops: [] };
      const stop = { id: 'stop-1', type: DeliveryStopType.COLLECTION, status: DeliveryStopStatus.ARRIVED };
      runRepo.findOne.mockResolvedValue(run);
      stopRepo.findOne.mockResolvedValue(stop);
      inspectionReportRepo.findOne.mockResolvedValue({ id: 'rep-123' });
      mockEntityManager.findOne.mockResolvedValueOnce(run).mockResolvedValueOnce(stop);

      const result = await service.createPickupReport('run-1', 'stop-1', 'driver-1', 'rep-123');
      expect(result.pickupReportId).toBe('rep-123');
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
