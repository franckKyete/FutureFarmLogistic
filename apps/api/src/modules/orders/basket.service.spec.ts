/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HarvestStatus } from '@futurefarm/types';
import { BasketService } from './basket.service';
import { BasketEntity } from './entities/basket.entity';
import { BasketLineEntity } from './entities/basket-line.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';

describe('BasketService', () => {
  let service: BasketService;
  let basketRepo: any;
  let basketLineRepo: any;
  let harvestRepo: any;

  const mockBasketRepo = {
    findOne: jest.fn(),
    save: jest.fn((basket) => Promise.resolve({ id: 'basket-1', ...basket })),
  };

  const mockBasketLineRepo = {
    findOne: jest.fn(),
    save: jest.fn((line) => Promise.resolve({ id: 'line-1', ...line })),
    remove: jest.fn(() => Promise.resolve()),
  };

  const mockHarvestRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BasketService,
        {
          provide: getRepositoryToken(BasketEntity),
          useValue: mockBasketRepo,
        },
        {
          provide: getRepositoryToken(BasketLineEntity),
          useValue: mockBasketLineRepo,
        },
        {
          provide: getRepositoryToken(HarvestEntity),
          useValue: mockHarvestRepo,
        },
      ],
    }).compile();

    service = module.get<BasketService>(BasketService);
    basketRepo = module.get(getRepositoryToken(BasketEntity));
    basketLineRepo = module.get(getRepositoryToken(BasketLineEntity));
    harvestRepo = module.get(getRepositoryToken(HarvestEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateBasket', () => {
    it('should return existing active basket', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'buyer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);

      const result = await service.getOrCreateBasket('buyer-1');
      expect(result).toEqual(mockBasket);
      expect(basketRepo.findOne).toHaveBeenCalledWith({
        where: { buyerId: 'buyer-1', status: 'ACTIVE' },
        relations: ['lines', 'lines.harvest', 'lines.harvest.product'],
      });
    });

    it('should create new basket if none active exists', async () => {
      basketRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateBasket('buyer-1');
      expect(result.buyerId).toBe('buyer-1');
      expect(result.status).toBe('ACTIVE');
      expect(basketRepo.save).toHaveBeenCalled();
    });
  });

  describe('addBasketLine', () => {
    it('should add new line successfully', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'buyer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);

      const mockHarvest = {
        id: 'harvest-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
        farmerProfile: { userId: 'farmer-1' },
      };
      harvestRepo.findOne.mockResolvedValue(mockHarvest);

      const result = await service.addBasketLine('buyer-1', {
        harvestId: 'harvest-1',
        quantity: 50,
      });

      expect(result.basketId).toBe('basket-1');
      expect(result.harvestId).toBe('harvest-1');
      expect(result.quantity).toBe(50);
      expect(basketLineRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if harvest not found', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'buyer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);
      harvestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addBasketLine('buyer-1', { harvestId: 'harvest-1', quantity: 50 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if harvest not approved', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'buyer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);

      const mockHarvest = {
        id: 'harvest-1',
        status: HarvestStatus.PENDING_APPROVAL,
        quantityInStock: 100,
        stockMarge: 10,
      };
      harvestRepo.findOne.mockResolvedValue(mockHarvest);

      await expect(
        service.addBasketLine('buyer-1', { harvestId: 'harvest-1', quantity: 50 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if buyer is the farmer', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'farmer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);

      const mockHarvest = {
        id: 'harvest-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
        farmerProfile: { userId: 'farmer-1' },
      };
      harvestRepo.findOne.mockResolvedValue(mockHarvest);

      await expect(
        service.addBasketLine('farmer-1', { harvestId: 'harvest-1', quantity: 50 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if quantity exceeds available stock', async () => {
      const mockBasket = { id: 'basket-1', buyerId: 'buyer-1', status: 'ACTIVE', lines: [] };
      basketRepo.findOne.mockResolvedValue(mockBasket);

      const mockHarvest = {
        id: 'harvest-1',
        status: HarvestStatus.APPROVED,
        quantityInStock: 100,
        stockMarge: 10,
        farmerProfile: { userId: 'farmer-1' },
      };
      harvestRepo.findOne.mockResolvedValue(mockHarvest);

      await expect(
        service.addBasketLine('buyer-1', { harvestId: 'harvest-1', quantity: 95 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
