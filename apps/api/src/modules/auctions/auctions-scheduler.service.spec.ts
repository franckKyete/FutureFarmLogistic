/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuctionStatus } from '@futurefarm/types';
import { AuctionsSchedulerService } from './auctions-scheduler.service';
import { AuctionsGateway } from './auctions.gateway';

describe('AuctionsSchedulerService', () => {
  let service: AuctionsSchedulerService;
  let gateway: AuctionsGateway;

  const mockEntityManager = {
    find: jest.fn(),
    save: jest.fn((entity: any) => Promise.resolve(entity)),
  };

  const mockDataSource = {
    transaction: jest.fn((modeOrCb: any, cb?: any) => {
      const actualCb = typeof modeOrCb === 'function' ? modeOrCb : cb;
      return actualCb(mockEntityManager);
    }),
  };

  const mockAuctionsGateway = {
    emitPriceTick: jest.fn(),
    emitExpired: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsSchedulerService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AuctionsGateway,
          useValue: mockAuctionsGateway,
        },
      ],
    }).compile();

    service = module.get<AuctionsSchedulerService>(AuctionsSchedulerService);
    gateway = module.get<AuctionsGateway>(AuctionsGateway);

    jest.clearAllMocks();
  });

  describe('handleCron', () => {
    it('should activate scheduled auctions that have started', async () => {
      const startAt = new Date(Date.now() - 5000);
      const scheduledAuction = {
        id: 'auc-1',
        status: AuctionStatus.SCHEDULED,
        startAt,
        priceDecrementIntervalMinutes: 5,
      };

      // Mock steps: find returns scheduled, then empty for others
      mockEntityManager.find.mockImplementation((_entityClass, options) => {
        if (options && options.where && options.where.status === AuctionStatus.SCHEDULED) {
          return Promise.resolve([scheduledAuction]);
        }
        return Promise.resolve([]);
      });

      await service.handleCron();

      expect(scheduledAuction.status).toBe(AuctionStatus.ACTIVE);
      expect(mockEntityManager.save).toHaveBeenCalledWith(scheduledAuction);
    });

    it('should expire active auctions that reached endAt deadline', async () => {
      const endAt = new Date(Date.now() - 5000);
      const activeAuction = {
        id: 'auc-2',
        status: AuctionStatus.ACTIVE,
        endAt,
        quantityOnOffer: 10,
        harvest: { id: 'har-1', quantityInStock: 20 },
      };

      mockEntityManager.find.mockImplementation((_entityClass, options) => {
        if (options && options.where && options.where.status === AuctionStatus.ACTIVE && options.where.endAt) {
          return Promise.resolve([activeAuction]);
        }
        return Promise.resolve([]);
      });

      await service.handleCron();

      expect(activeAuction.status).toBe(AuctionStatus.EXPIRED);
      expect(activeAuction.harvest.quantityInStock).toBe(30);
      expect(gateway.emitExpired).toHaveBeenCalledWith('auc-2', 'DEADLINE');
    });

    it('should decrement price of active auctions if ticking interval passed', async () => {
      const nextDecrementAt = new Date(Date.now() - 5000);
      const activeAuction = {
        id: 'auc-3',
        status: AuctionStatus.ACTIVE,
        nextDecrementAt,
        currentPrice: 100,
        reservePrice: 50,
        priceDecrementIntervalMinutes: 5,
        priceDecrementAmount: 10,
        harvest: { id: 'har-1', quantityInStock: 20 },
      };

      mockEntityManager.find.mockImplementation((_entityClass, options) => {
        if (options && options.where && options.where.status === AuctionStatus.ACTIVE && options.where.nextDecrementAt) {
          return Promise.resolve([activeAuction]);
        }
        return Promise.resolve([]);
      });

      await service.handleCron();

      expect(activeAuction.currentPrice).toBe(90);
      expect(gateway.emitPriceTick).toHaveBeenCalledWith('auc-3', 90, expect.any(Date));
    });

    it('should expire active auction if decremented price hits or drops below reservePrice floor', async () => {
      const nextDecrementAt = new Date(Date.now() - 5000);
      const activeAuction = {
        id: 'auc-4',
        status: AuctionStatus.ACTIVE,
        nextDecrementAt,
        currentPrice: 55,
        reservePrice: 50,
        priceDecrementIntervalMinutes: 5,
        priceDecrementAmount: 10,
        quantityOnOffer: 10,
        harvest: { id: 'har-1', quantityInStock: 20 },
      };

      mockEntityManager.find.mockImplementation((_entityClass, options) => {
        if (options && options.where && options.where.status === AuctionStatus.ACTIVE && options.where.nextDecrementAt) {
          return Promise.resolve([activeAuction]);
        }
        return Promise.resolve([]);
      });

      await service.handleCron();

      expect(activeAuction.status).toBe(AuctionStatus.EXPIRED);
      expect(activeAuction.currentPrice).toBe(50);
      expect(activeAuction.harvest.quantityInStock).toBe(30);
      expect(gateway.emitExpired).toHaveBeenCalledWith('auc-4', 'FLOOR_PRICE');
    });
  });
});
