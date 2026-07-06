/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { ProductCategory, HarvestStatus, HarvestUnit } from '@futurefarm/types';
import { ProductsService } from './products.service';
import { ProductEntity } from './entities/product.entity';
import { HarvestEntity } from './entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { ParcelEntity } from '../users/entities/parcel.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: any;
  let harvestRepository: any;
  let farmerProfileRepository: any;
  let parcelRepository: any;
  let configService: any;

  const mockProductRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHarvestRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFarmerProfileRepository = {
    findOne: jest.fn(),
  };

  const mockParcelRepository = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepository,
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
          provide: getRepositoryToken(ParcelEntity),
          useValue: mockParcelRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepository = module.get(getRepositoryToken(ProductEntity));
    harvestRepository = module.get(getRepositoryToken(HarvestEntity));
    farmerProfileRepository = module.get(
      getRepositoryToken(FarmerProfileEntity),
    );
    parcelRepository = module.get(getRepositoryToken(ParcelEntity));
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('should create a crop product template if it does not exist', async () => {
      const dto = {
        name: 'Medjool Dates',
        category: ProductCategory.DATES,
        description: 'Sweet dates',
      };
      productRepository.findOne.mockResolvedValue(null);
      productRepository.create.mockReturnValue(dto);
      productRepository.save.mockResolvedValue({ id: 'prod-uuid', ...dto });

      const result = await service.createProduct(dto);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { name: dto.name },
      });
      expect(productRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 'prod-uuid');
    });

    it('should throw BadRequestException if product template name already exists', async () => {
      const dto = { name: 'Medjool Dates', category: ProductCategory.DATES };
      productRepository.findOne.mockResolvedValue({ id: 'existing-id' });

      await expect(service.createProduct(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createHarvest', () => {
    const userId = 'user-farmer-id';
    const farmerProfile = { id: 'farmer-profile-id', userId };
    const product = { id: 'product-id', name: 'Medjool Dates' };
    const createDto = {
      productId: 'product-id',
      harvestDate: '2026-07-01',
      expirationDate: '2026-08-01',
      quantityInStock: 100,
      stockMarge: 5,
      pricePerUnit: 10,
      unit: HarvestUnit.KG,
      farmingMethods: 'Organic',
      photoUrls: [],
    };

    it('should throw ForbiddenException if user is not a farmer', async () => {
      farmerProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.createHarvest(userId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if product crop template is not found', async () => {
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.createHarvest(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if specified parcel does not belong to farmer profile', async () => {
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);
      productRepository.findOne.mockResolvedValue(product);
      parcelRepository.findOne.mockResolvedValue({
        id: 'parcel-id',
        farmerProfileId: 'other-farmer-id',
      });

      const dtoWithParcel = { ...createDto, parcelId: 'parcel-id' };

      await expect(
        service.createHarvest(userId, dtoWithParcel),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully create harvest with PENDING_APPROVAL status', async () => {
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);
      productRepository.findOne.mockResolvedValue(product);
      parcelRepository.findOne.mockResolvedValue({
        id: 'parcel-id',
        farmerProfileId: farmerProfile.id,
      });

      const dtoWithParcel = { ...createDto, parcelId: 'parcel-id' };
      harvestRepository.create.mockImplementation((args: any) => args);
      harvestRepository.save.mockImplementation((harvest: any) =>
        Promise.resolve({ id: 'harvest-id', ...harvest }),
      );

      const result = await service.createHarvest(userId, dtoWithParcel);

      expect(result.status).toBe(HarvestStatus.PENDING_APPROVAL);
      expect(result.farmerProfileId).toBe(farmerProfile.id);
      expect(result.productId).toBe(product.id);
    });
  });

  describe('updateHarvest', () => {
    const userId = 'farmer-user-id';
    const farmerProfile = { id: 'farmer-profile-id', userId };
    const harvest = {
      id: 'harvest-id',
      farmerProfileId: farmerProfile.id,
      status: HarvestStatus.APPROVED,
    };

    it('should throw NotFoundException if harvest does not exist', async () => {
      harvestRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateHarvest('invalid-id', userId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner of the harvest', async () => {
      harvestRepository.findOne.mockResolvedValue({
        id: 'harvest-id',
        farmerProfileId: 'other-profile-id',
      });
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);

      await expect(
        service.updateHarvest('harvest-id', userId, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update harvest and reset approval status to PENDING_APPROVAL', async () => {
      harvestRepository.findOne.mockResolvedValue(harvest);
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);
      harvestRepository.save.mockImplementation((h: any) => Promise.resolve(h));

      const result = await service.updateHarvest('harvest-id', userId, {
        quantityInStock: 200,
      });

      expect(result.status).toBe(HarvestStatus.PENDING_APPROVAL);
      expect(result.approvedById).toBeNull();
      expect(result.approvedAt).toBeNull();
      expect(result.rejectionReason).toBeNull();
    });
  });

  describe('deleteHarvest', () => {
    const userId = 'farmer-user-id';
    const farmerProfile = { id: 'farmer-profile-id', userId };
    const harvest = {
      id: 'harvest-id',
      farmerProfileId: farmerProfile.id,
      status: HarvestStatus.APPROVED,
    };

    it('should archive harvest rather than delete it', async () => {
      harvestRepository.findOne.mockResolvedValue(harvest);
      farmerProfileRepository.findOne.mockResolvedValue(farmerProfile);
      harvestRepository.save.mockImplementation((h: any) => Promise.resolve(h));

      await service.deleteHarvest('harvest-id', userId);

      expect(harvest.status).toBe(HarvestStatus.ARCHIVED);
    });
  });

  describe('verifyHarvest', () => {
    it('should throw BadRequestException if harvest is archived', async () => {
      harvestRepository.findOne.mockResolvedValue({
        id: 'id',
        status: HarvestStatus.ARCHIVED,
      });

      await expect(
        service.verifyHarvest('id', 'inspector-id', {
          status: HarvestStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve harvest listing and record inspector context', async () => {
      const harvest = { id: 'id', status: HarvestStatus.PENDING_APPROVAL };
      harvestRepository.findOne.mockResolvedValue(harvest);
      harvestRepository.save.mockImplementation((h: any) => Promise.resolve(h));

      const result = await service.verifyHarvest('id', 'inspector-id', {
        status: HarvestStatus.APPROVED,
        qualityScore: 9.2,
      });

      expect(result.status).toBe(HarvestStatus.APPROVED);
      expect(result.approvedById).toBe('inspector-id');
      expect(result.qualityScore).toBe(9.2);
      expect(result.rejectionReason).toBeNull();
    });

    it('should reject harvest listing and clear quality score', async () => {
      const harvest = {
        id: 'id',
        status: HarvestStatus.PENDING_APPROVAL,
        qualityScore: 8.0,
      };
      harvestRepository.findOne.mockResolvedValue(harvest);
      harvestRepository.save.mockImplementation((h: any) => Promise.resolve(h));

      const result = await service.verifyHarvest('id', 'inspector-id', {
        status: HarvestStatus.REJECTED,
        rejectionReason: 'Damaged crop',
      });

      expect(result.status).toBe(HarvestStatus.REJECTED);
      expect(result.qualityScore).toBeNull();
      expect(result.rejectionReason).toBe('Damaged crop');
    });
  });

  describe('getDecayedPrice', () => {
    it('should calculate decayed price correctly based on remaining days', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 3); // 3 days remaining

      const harvest = {
        id: 'harvest-id',
        pricePerUnit: 10.0,
        expirationDate,
        priceDecayConfig: {
          decaySteps: [
            { daysBeforeExpiration: 5, priceMultiplier: 0.8 },
            { daysBeforeExpiration: 2, priceMultiplier: 0.5 },
          ],
        },
      };

      harvestRepository.findOne.mockResolvedValue(harvest);

      // Remaining days is 3. 3 <= 5 applies, but 3 <= 2 does not. Multiplier should be 0.8.
      const result = await service.getDecayedPrice('harvest-id');

      expect(result.basePrice).toBe(10.0);
      expect(result.decayedPrice).toBe(8.0);
      expect(result.multiplier).toBe(0.8);
    });

    it('should return full price if no decay configuration matches remaining shelf life', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 10); // 10 days remaining

      const harvest = {
        id: 'harvest-id',
        pricePerUnit: 10.0,
        expirationDate,
        priceDecayConfig: {
          decaySteps: [{ daysBeforeExpiration: 5, priceMultiplier: 0.8 }],
        },
      };

      harvestRepository.findOne.mockResolvedValue(harvest);

      const result = await service.getDecayedPrice('harvest-id');

      expect(result.basePrice).toBe(10.0);
      expect(result.decayedPrice).toBe(10.0);
      expect(result.multiplier).toBe(1.0);
    });
  });

  describe('aiSuggest', () => {
    it('should throw InternalServerErrorException if GEMINI_API_KEY is missing', async () => {
      configService.get.mockReturnValue(null);

      await expect(service.aiSuggest('Test prompt')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should call Gemini API and parse suggestion successfully', async () => {
      configService.get.mockReturnValue('valid-api-key');

      const mockResponse = {
        suggestedName: 'Premium Medjool Dates',
        category: ProductCategory.DATES,
        description: 'Excellent sweet dates.',
        farmingMethods: 'Organic farming in desert oasis.',
        recommendedShelfLifeDays: 90,
      };

      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(mockResponse),
                    },
                  ],
                },
              },
            ],
          }),
      });
      global.fetch = mockFetch;

      const result = await service.aiSuggest('organic sweet dates');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.suggestedName).toBe('Premium Medjool Dates');
      expect(result.category).toBe(ProductCategory.DATES);
    });

    it('should throw InternalServerErrorException if Gemini API returns non-JSON or error response', async () => {
      configService.get.mockReturnValue('valid-api-key');
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      global.fetch = mockFetch;

      await expect(service.aiSuggest('organic sweet dates')).rejects.toThrow();
    });
  });

  describe('findAllHarvests and findFarmerOwnHarvests', () => {
    it('should list all harvests query build successfully', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      harvestRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAllHarvests({ isPublicView: true });
      expect(result).toEqual([]);
    });

    it('should list farmer own harvests successfully', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      harvestRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findFarmerOwnHarvests('farmer-user-1');
      expect(result).toEqual([]);
    });
  });
});
