import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
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
          useValue: { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ id: 'ping-id', ...x })) },
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
  });
});
