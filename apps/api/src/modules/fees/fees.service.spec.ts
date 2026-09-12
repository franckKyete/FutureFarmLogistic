import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { FeeCalculationType } from '@futurefarm/types';
import { FeesService } from './fees.service';
import { PlatformFeeEntity } from './entities/platform-fee.entity';

describe('FeesService', () => {
  let service: FeesService;
  let repo: any;

  const mockFees: PlatformFeeEntity[] = [
    {
      id: 'fee-1',
      name: 'Frais de livraison',
      code: 'DELIVERY',
      calculationType: FeeCalculationType.FIXED,
      value: 2.90,
      currency: 'USD',
      isActive: true,
      description: 'Standard delivery',
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'fee-2',
      name: 'Frais de service',
      code: 'SERVICE',
      calculationType: FeeCalculationType.FIXED,
      value: 0.50,
      currency: 'USD',
      isActive: true,
      description: 'Platform maintenance',
      displayOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'fee-3',
      name: 'TVA',
      code: 'VAT',
      calculationType: FeeCalculationType.PERCENTAGE,
      value: 5.0,
      currency: 'USD',
      isActive: true,
      description: 'Taxe 5%',
      displayOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue(mockFees),
      findOne: jest.fn().mockImplementation(({ where }: any) => {
        if (where?.id) return Promise.resolve(mockFees.find((f) => f.id === where.id) || null);
        if (where?.code) return Promise.resolve(mockFees.find((f) => f.code === where.code) || null);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((dto: any) => ({ id: 'new-id', ...dto })),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ id: 'saved-id', ...entity })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        {
          provide: getRepositoryToken(PlatformFeeEntity),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates order fees correctly in CDF with exchange rate', async () => {
    const subtotal = 5900; // CDF
    const exchangeRate = 2300; // 1 USD = 2300 CDF

    const result = await service.calculateFeesForOrder(subtotal, exchangeRate);

    // Fixed fee 1: 2.90 USD * 2300 = 6670 CDF
    // Fixed fee 2: 0.50 USD * 2300 = 1150 CDF
    // Percentage fee: 5900 * 5% = 295 CDF
    // Total fees = 6670 + 1150 + 295 = 8115 CDF
    expect(result.fees).toHaveLength(3);
    expect(result.fees[0]?.amount).toBe(6670);
    expect(result.fees[1]?.amount).toBe(1150);
    expect(result.fees[2]?.amount).toBe(295);
    expect(result.totalFeesAmount).toBe(8115);
  });

  it('calculates order fees in USD (exchange rate 1.0)', async () => {
    const subtotal = 100; // USD
    const exchangeRate = 1.0;

    const result = await service.calculateFeesForOrder(subtotal, exchangeRate);

    // 2.90 + 0.50 + 5.00 = 8.40 USD
    expect(result.totalFeesAmount).toBe(8.40);
    expect(result.totalFeesAmountUSD).toBe(8.40);
  });

  it('creates a new platform fee successfully', async () => {
    repo.findOne.mockResolvedValueOnce(null); // No existing code

    const created = await service.createFee({
      name: 'Eco Tax',
      code: 'ECO_TAX',
      calculationType: FeeCalculationType.FIXED,
      value: 1.0,
    });

    expect(created.code).toBe('ECO_TAX');
    expect(repo.save).toHaveBeenCalled();
  });

  it('rejects duplicate fee code on create', async () => {
    repo.findOne.mockResolvedValueOnce(mockFees[0]);

    await expect(
      service.createFee({
        name: 'Duplicate',
        code: 'DELIVERY',
        calculationType: FeeCalculationType.FIXED,
        value: 2.0,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
