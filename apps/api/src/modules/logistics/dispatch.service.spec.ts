import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  DeliveryStopType,
  OrderStatus,
  PaymentStatus,
} from '@futurefarm/types';
import { DispatchService } from './dispatch.service';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { DriverProfileService } from './driver-profile.service';
import { VehiclesService } from './vehicles.service';
import { LogisticsService } from './logistics.service';
import { VrpRouteOptimizer } from './vrp-route-optimizer';
import { ROUTE_OPTIMIZER_PORT } from './interfaces/route-optimizer.port';

describe('DispatchService', () => {
  let service: DispatchService;
  let runRepo: any;
  let stopRepo: any;
  let orderRepo: any;
  let driverProfileService: any;
  let vehiclesService: any;
  let logisticsService: any;
  let routeOptimizer: any;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn((entityOrClass: any, maybeEntity?: any) => {
      const entity = maybeEntity ?? entityOrClass;
      return Promise.resolve({ id: 'saved-entity-id', ...entity });
    }),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((entityOrClass: any, maybeEntity?: any) => maybeEntity ?? entityOrClass),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    runRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((run: any) => Promise.resolve({ id: run.id || 'run-1', ...run })),
    };

    stopRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((stops: any) => Promise.resolve(stops)),
    };

    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn((order: any) => Promise.resolve(order)),
    };

    driverProfileService = {
      listAvailableProfiles: jest.fn().mockResolvedValue([
        {
          id: 'driver-prof-1',
          userId: 'driver-1',
          isAvailable: true,
          vehicle: {
            id: 'vehicle-1',
            capacityKg: 1000,
            type: 'VAN',
          },
        },
      ]),
      getProfileByUserId: jest.fn().mockResolvedValue({
        id: 'driver-prof-1',
        userId: 'driver-1',
        isAvailable: true,
        vehicle: {
          id: 'vehicle-1',
          capacityKg: 1000,
          type: 'VAN',
        },
      }),
    };

    vehiclesService = {
      listAvailable: jest.fn().mockResolvedValue([
        {
          id: 'vehicle-1',
          capacityKg: 1000,
          type: 'VAN',
          isActive: true,
        },
      ]),
    };

    logisticsService = {
      createRun: jest.fn((dto: any) =>
        Promise.resolve({
          id: 'new-run-id',
          status: DeliveryRunStatus.PLANNED,
          driverId: dto.driverId || null,
          vehicleId: dto.vehicleId || null,
          scheduledAt: new Date(dto.scheduledAt),
          stops: dto.stops.map((s: any, idx: number) => ({
            id: `stop-${idx}`,
            ...s,
            status: DeliveryStopStatus.PENDING,
            sequenceOrder: idx + 1,
          })),
        }),
      ),
    };

    routeOptimizer = {
      optimise: jest.fn((waypoints: any[]) =>
        Promise.resolve({
          orderedWaypoints: waypoints.map((wp, i) => ({ ...wp, originalIndex: i })),
          totalDistanceKm: 12.0,
          totalDurationSec: 1800, // 30 mins
        }),
      ),
      table: jest.fn(() => Promise.resolve([[0, 10], [10, 0]])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: getRepositoryToken(DeliveryRunEntity), useValue: runRepo },
        { provide: getRepositoryToken(DeliveryStopEntity), useValue: stopRepo },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: DriverProfileService, useValue: driverProfileService },
        { provide: VehiclesService, useValue: vehiclesService },
        { provide: LogisticsService, useValue: logisticsService },
        VrpRouteOptimizer,
        { provide: ROUTE_OPTIMIZER_PORT, useValue: routeOptimizer },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Working hours scheduling', () => {
    it('should schedule a delivery today if time permits, or next day at 08:00', async () => {
      const mockOrder = {
        id: 'order-1',
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
        deliveryAddress: {
          recipientName: 'Jean Dupont',
          streetAddress: 'Boulevard du 30 Juin',
          city: 'Kinshasa',
          lat: -4.305,
          lon: 15.305,
        },
        lines: [
          {
            id: 'line-1',
            quantity: 50,
            farmerProfileId: 'farmer-1',
            farmerProfile: {
              regionName: 'Kinshasa',
              address: 'Route de Maluku',
              parcels: [{ locationCoordinates: '-4.35, 15.45' }],
            },
            harvest: {
              product: { name: 'Manioc' },
            },
          },
        ],
      };

      orderRepo.findOne.mockResolvedValue(mockOrder);

      await service.processOrderDispatch('order-1');

      expect(logisticsService.createRun).toHaveBeenCalled();
      const callArgs = logisticsService.createRun.mock.calls[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.stops.length).toBe(2); // 1 collection + 1 delivery
      const scheduledDate = new Date(callArgs.scheduledAt);
      expect(scheduledDate.getHours()).toBeGreaterThanOrEqual(8);
      expect(scheduledDate.getHours()).toBeLessThanOrEqual(18);
    });
  });

  describe('recalculateForRejectedLine', () => {
    it('should cancel the delivery run if all collection stops are skipped or rejected', async () => {
      const mockStop = {
        id: 'stop-1',
        runId: 'run-1',
        orderLineId: 'line-1',
        type: DeliveryStopType.COLLECTION,
        status: DeliveryStopStatus.PENDING,
        address: { lat: -4.35, lon: 15.45 },
      };

      const mockRun = {
        id: 'run-1',
        status: DeliveryRunStatus.PLANNED,
        stops: [mockStop],
      };

      stopRepo.findOne.mockResolvedValue(mockStop);
      stopRepo.find.mockResolvedValue([mockStop]);
      runRepo.findOne.mockResolvedValue(mockRun);

      await service.recalculateForRejectedLine('order-1', 'line-1');

      expect(mockStop.status).toBe(DeliveryStopStatus.SKIPPED);
      expect(mockRun.status).toBe(DeliveryRunStatus.CANCELLED);
      expect(runRepo.save).toHaveBeenCalledWith(mockRun);
    });

    it('should re-sequence and recalculate route if other active collection stops remain', async () => {
      const mockStop1 = {
        id: 'stop-1',
        runId: 'run-1',
        orderLineId: 'line-1',
        type: DeliveryStopType.COLLECTION,
        status: DeliveryStopStatus.PENDING,
        sequence: 1,
        address: { street: 'A', city: 'K', lat: -4.35, lon: 15.45 },
      };

      const mockStop2 = {
        id: 'stop-2',
        runId: 'run-1',
        orderLineId: 'line-2',
        type: DeliveryStopType.COLLECTION,
        status: DeliveryStopStatus.PENDING,
        sequence: 2,
        address: { street: 'B', city: 'K', lat: -4.36, lon: 15.46 },
      };

      const mockStop3 = {
        id: 'stop-3',
        runId: 'run-1',
        orderLineId: 'line-1',
        type: DeliveryStopType.DELIVERY,
        status: DeliveryStopStatus.PENDING,
        sequence: 3,
        address: { street: 'C', city: 'K', lat: -4.30, lon: 15.30 },
      };

      const mockRun = {
        id: 'run-1',
        scheduledAt: new Date(),
        status: DeliveryRunStatus.PLANNED,
        stops: [mockStop1, mockStop2, mockStop3],
      };

      stopRepo.findOne.mockResolvedValue(mockStop1);
      stopRepo.find.mockResolvedValue([mockStop1, mockStop2, mockStop3]);
      runRepo.findOne.mockResolvedValue(mockRun);

      await service.recalculateForRejectedLine('order-1', 'line-1');

      expect(mockStop1.status).toBe(DeliveryStopStatus.SKIPPED);
      expect(mockRun.status).toBe(DeliveryRunStatus.PLANNED);
      expect(routeOptimizer.optimise).toHaveBeenCalled();
    });
  });
});
