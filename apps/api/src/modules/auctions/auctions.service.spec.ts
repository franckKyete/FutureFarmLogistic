/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuctionStatus, HarvestStatus } from '@futurefarm/types';
import { AuctionsService } from './auctions.service';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { AuctionsGateway } from './auctions.gateway';

describe('AuctionsService', () => {
  let service: AuctionsService;
  let auctionRepository: any;
  let harvestRepository: any;
  let farmerProfileRepository: any;
  let auctionsGateway: any;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((modeOrFactory, factory?) => {
      const executionFactory =
        typeof modeOrFactory === 'function' ? modeOrFactory : factory;
      return executionFactory(mockEntityManager);
    }),
  };

  const mockAuctionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn((x) => Promise.resolve({ id: 'auction-123', ...x })),
    createQueryBuilder: jest.fn(),
  };

  const mockBidRepository = {
    find: jest.fn(),
  };

  const mockHarvestRepository = {
    findOne: jest.fn(),
    save: jest.fn((x) => Promise.resolve(x)),
  };

  const mockFarmerProfileRepository = {
    findOne: jest.fn(),
  };

  const mockAuctionsGateway = {
    emitPriceTick: jest.fn(),
    emitSold: jest.fn(),
    emitExpired: jest.fn(),
    emitCancelled: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsService,
        {
          provide: getRepositoryToken(AuctionEntity),
          useValue: mockAuctionRepository,
        },
        {
          provide: getRepositoryToken(BidEntity),
          useValue: mockBidRepository,
        },
        {
          provide: getRepositoryToken(HarvestEntity),
          useValue: mockHarvestRepository,
        },
        {
          provide: getRepositoryToken(FarmerProfileEntity),
          useValue: mockFarmerProfileRepository,
        },
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

    service = module.get<AuctionsService>(AuctionsService);
    auctionRepository = module.get(getRepositoryToken(AuctionEntity));
    harvestRepository = module.get(getRepositoryToken(HarvestEntity));
    farmerProfileRepository = module.get(
      getRepositoryToken(FarmerProfileEntity),
    );
    auctionsGateway = module.get(AuctionsGateway);
  });

  describe('createAuction', () => {
    const createDto = {
      harvestId: 'harvest-123',
      startingPrice: 100,
      reservePrice: 50,
      priceDecrementAmount: 5,
      priceDecrementIntervalMinutes: 10,
      startAt: '2026-07-04T18:00:00.000Z',
      endAt: '2026-07-05T18:00:00.000Z',
      quantityOnOffer: 50,
    };

    it('should fail if user is not a farmer', async () => {
      farmerProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.createAuction('user-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should fail if harvest not found', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue(null);

      await expect(service.createAuction('user-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should fail if harvest belongs to another farmer', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-123',
        farmerProfileId: 'farmer-2',
      });

      await expect(service.createAuction('user-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should fail if harvest is not approved', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-123',
        farmerProfileId: 'farmer-1',
        status: HarvestStatus.PENDING_APPROVAL,
      });

      await expect(service.createAuction('user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should fail if quantity exceeds effective stock', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-123',
        farmerProfileId: 'farmer-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 60,
        stockMarge: 20, // effective stock = 40
      });

      await expect(
        service.createAuction('user-1', createDto), // quantityOnOffer = 50
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail if starting price is below reserve price', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-123',
        farmerProfileId: 'farmer-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
      });

      await expect(
        service.createAuction('user-1', {
          ...createDto,
          startingPrice: 40,
          reservePrice: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an auction and deduct stock successfully', async () => {
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-123',
        farmerProfileId: 'farmer-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
      });
      auctionRepository.findOne.mockResolvedValue(null);

      const result = await service.createAuction('user-1', createDto);

      expect(result.id).toBe('auction-123');
      expect(harvestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantityInStock: 50 }),
      );
      expect(auctionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          startingPrice: 100,
          reservePrice: 50,
        }),
      );
    });
  });

  describe('placeBid', () => {
    it('should fail if auction not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);

      await expect(service.placeBid('buyer-1', 'auction-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should fail if auction is not active', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        id: 'auction-1',
        status: AuctionStatus.SCHEDULED,
        farmerProfile: { userId: 'farmer-1' },
      });

      await expect(service.placeBid('buyer-1', 'auction-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should fail if buyer is the farmer', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        id: 'auction-1',
        status: AuctionStatus.ACTIVE,
        farmerProfile: { userId: 'farmer-1' },
      });

      await expect(service.placeBid('farmer-1', 'auction-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should win auction and emit WS sold event on success', async () => {
      const mockAuction = {
        id: 'auction-1',
        status: AuctionStatus.ACTIVE,
        currentPrice: 80,
        quantityOnOffer: 50,
        farmerProfile: { userId: 'farmer-1' },
        winnerId: null as any,
        soldAt: null as any,
        winningBidId: null as any,
      };
      mockEntityManager.findOne.mockResolvedValue(mockAuction);
      mockEntityManager.save.mockImplementation((x) => Promise.resolve(x));

      const bid = await service.placeBid('buyer-1', 'auction-1');

      expect(bid.priceAtBid).toBe(80);
      expect(bid.quantityWon).toBe(50);
      expect(mockAuction.status).toBe(AuctionStatus.SOLD);
      expect(mockAuction.winnerId).toBe('buyer-1');
      expect(auctionsGateway.emitSold).toHaveBeenCalledWith(
        'auction-1',
        'buyer-1',
        80,
        expect.any(Date),
      );
    });
  });

  describe('cancelAuction', () => {
    it('should fail if auction not found', async () => {
      auctionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelAuction('farmer-1', 'auction-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fail if auction is already sold/expired', async () => {
      auctionRepository.findOne.mockResolvedValue({
        id: 'auction-1',
        status: AuctionStatus.SOLD,
      });

      await expect(
        service.cancelAuction('farmer-1', 'auction-1', false),
      ).rejects.toThrow(ConflictException);
    });

    it('should fail if non-owner tries to cancel without admin role', async () => {
      auctionRepository.findOne.mockResolvedValue({
        id: 'auction-1',
        status: AuctionStatus.ACTIVE,
        farmerProfileId: 'farmer-1',
      });
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-2' });

      await expect(
        service.cancelAuction('user-2', 'auction-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should cancel, refund stock, and emit WS event successfully', async () => {
      const mockAuction = {
        id: 'auction-1',
        status: AuctionStatus.ACTIVE,
        harvestId: 'harvest-1',
        quantityOnOffer: 50,
        farmerProfileId: 'farmer-1',
      };
      auctionRepository.findOne.mockResolvedValue(mockAuction);
      farmerProfileRepository.findOne.mockResolvedValue({ id: 'farmer-1' });
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-1',
        quantityInStock: 40,
      });

      const cancelled = await service.cancelAuction(
        'user-1',
        'auction-1',
        false,
      );

      expect(cancelled.status).toBe(AuctionStatus.CANCELLED);
      expect(harvestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantityInStock: 90 }),
      );
      expect(auctionsGateway.emitCancelled).toHaveBeenCalledWith('auction-1');
    });
  });
});
