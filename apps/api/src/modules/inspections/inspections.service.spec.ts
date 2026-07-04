/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

import {
  InspectionStatus,
  HarvestStatus,
  ProductCategory,
  InspectionChecklistItem,
} from '@futurefarm/types';

import { InspectionsService } from './inspections.service';
import { InspectorProfileEntity } from './entities/inspector-profile.entity';
import { InspectionReportEntity } from './entities/inspection-report.entity';
import { InspectionPhotoEntity } from './entities/inspection-photo.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { ProductEntity } from '../products/entities/product.entity';

describe('InspectionsService', () => {
  let service: InspectionsService;
  let inspectorProfileRepo: jest.Mocked<Repository<InspectorProfileEntity>>;
  let reportRepo: jest.Mocked<Repository<InspectionReportEntity>>;
  let userRepo: jest.Mocked<Repository<UserEntity>>;
  let harvestRepo: jest.Mocked<Repository<HarvestEntity>>;
  let productRepo: jest.Mocked<Repository<ProductEntity>>;
  let mockVisionProvider: any;

  const mockChecklist = {
    [InspectionChecklistItem.VISUAL_QUALITY]: { passed: true, notes: 'Good' },
    [InspectionChecklistItem.MICROBIAL_COUNT]: { passed: true, notes: 'Clear' },
    [InspectionChecklistItem.WEIGHT_CALIBRATION]: {
      passed: true,
      notes: 'Calibrated',
    },
    [InspectionChecklistItem.PACKAGING]: { passed: true, notes: 'Intact' },
    [InspectionChecklistItem.LABELING]: { passed: true, notes: 'Correct' },
  };

  beforeEach(async () => {
    mockVisionProvider = {
      analyzeHarvestPhotos: jest.fn(),
      classifyHarvestPhotos: jest.fn(),
    };

    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        {
          provide: getRepositoryToken(InspectorProfileEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(InspectionReportEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(InspectionPhotoEntity),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(UserEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(HarvestEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(ProductEntity), useFactory: mockRepo },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: 'QUALITY_VISION_PROVIDER', useValue: mockVisionProvider },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
    inspectorProfileRepo = module.get(
      getRepositoryToken(InspectorProfileEntity),
    );
    reportRepo = module.get(getRepositoryToken(InspectionReportEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    harvestRepo = module.get(getRepositoryToken(HarvestEntity));
    productRepo = module.get(getRepositoryToken(ProductEntity));
  });

  describe('createInspectorProfile', () => {
    it('should create and save inspector profile successfully', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-id' } as UserEntity);
      inspectorProfileRepo.findOne.mockResolvedValue(null);
      inspectorProfileRepo.create.mockImplementation((dto: any) => dto);
      inspectorProfileRepo.save.mockImplementation((profile: any) =>
        Promise.resolve({ id: 'prof-id', ...profile }),
      );

      const res = await service.createInspectorProfile('user-id', {
        licenseNumber: 'L-123',
        agencyName: 'Agency X',
        specializations: ['DATES'],
      });

      expect(res).toHaveProperty('id', 'prof-id');
      expect(res.licenseNumber).toBe('L-123');
    });

    it('should throw BadRequestException if profile already exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-id' } as UserEntity);
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
      } as InspectorProfileEntity);

      await expect(
        service.createInspectorProfile('user-id', {
          licenseNumber: 'L-123',
          agencyName: 'Agency X',
          specializations: ['DATES'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createReport', () => {
    it('should create report in progress', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      } as InspectorProfileEntity);
      harvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        status: HarvestStatus.PENDING_APPROVAL,
      } as HarvestEntity);
      reportRepo.create.mockImplementation((dto: any) => dto);
      reportRepo.save.mockImplementation((report: any) =>
        Promise.resolve({ id: 'report-id', ...report }),
      );

      const res = await service.createReport('user-id', {
        harvestId: 'harvest-id',
        siteVisitDate: '2026-07-04',
        checklist: mockChecklist,
      });

      expect(res).toHaveProperty('status', InspectionStatus.IN_PROGRESS);
      expect(res.harvestId).toBe('harvest-id');
    });

    it('should throw BadRequestException if harvest is not pending approval', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      } as InspectorProfileEntity);
      harvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        status: HarvestStatus.APPROVED,
      } as HarvestEntity);

      await expect(
        service.createReport('user-id', {
          harvestId: 'harvest-id',
          siteVisitDate: '2026-07-04',
          checklist: mockChecklist,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitReport', () => {
    it('should submit report and approve harvest if score >= 4.0', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      } as InspectorProfileEntity);
      reportRepo.findOne.mockResolvedValue({
        id: 'report-id',
        status: InspectionStatus.IN_PROGRESS,
        inspectorProfileId: 'prof-id',
        harvestId: 'harvest-id',
      } as InspectionReportEntity);
      harvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
      } as HarvestEntity);
      reportRepo.save.mockImplementation((r: any) => Promise.resolve(r));
      harvestRepo.save.mockImplementation((h: any) => Promise.resolve(h));

      const res = await service.submitReport('report-id', 'user-id', {
        finalQualityScore: 8.5,
        overallNotes: 'Passed cleanly',
      });

      expect(res.status).toBe(InspectionStatus.SUBMITTED);
      expect(res.finalQualityScore).toBe(8.5);
    });

    it('should reject report and harvest if score < 4.0', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      } as InspectorProfileEntity);
      reportRepo.findOne.mockResolvedValue({
        id: 'report-id',
        status: InspectionStatus.IN_PROGRESS,
        inspectorProfileId: 'prof-id',
        harvestId: 'harvest-id',
      } as InspectionReportEntity);
      harvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
      } as HarvestEntity);
      reportRepo.save.mockImplementation((r: any) => Promise.resolve(r));
      harvestRepo.save.mockImplementation((h: any) => Promise.resolve(h));

      const res = await service.submitReport('report-id', 'user-id', {
        finalQualityScore: 3.5,
        overallNotes: 'Bad quality',
      });

      expect(res.status).toBe(InspectionStatus.REJECTED);
      expect(res.finalQualityScore).toBe(3.5);
    });
  });

  describe('runAiPreScreen', () => {
    it('should query vision provider and set screen scores', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      } as InspectorProfileEntity);
      reportRepo.findOne.mockResolvedValue({
        id: 'report-id',
        status: InspectionStatus.IN_PROGRESS,
        inspectorProfileId: 'prof-id',
        photos: [{ url: 'http://test.com/photo.jpg' }],
      } as InspectionReportEntity);
      mockVisionProvider.analyzeHarvestPhotos.mockResolvedValue({
        suggestedScore: 9.0,
        detectedDefects: [],
        analysisNotes: 'Looks perfect',
      });
      reportRepo.save.mockImplementation((r: any) => Promise.resolve(r));

      const res = await service.runAiPreScreen('report-id', 'user-id');

      expect(res.aiPreScreenScore).toBe(9.0);
      expect(res.aiPreScreenNotes).toContain('Looks perfect');
    });
  });

  describe('classifyHarvest', () => {
    it('should query vision provider and matching product', async () => {
      mockVisionProvider.classifyHarvestPhotos.mockResolvedValue({
        suggestedName: 'Roma Tomatoes',
        category: ProductCategory.VEGETABLES,
        description: 'AI Description',
        farmingMethods: 'Organic',
        recommendedShelfLifeDays: 14,
        estimatedQuantity: 200,
        suggestedPricePerUnit: 3.5,
        aiQualityScore: 8.5,
      });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ id: 'matching-prod-id', name: 'Roma Tomatoes' }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      productRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const res = await service.classifyHarvest({
        photoUrls: ['http://test.com/photo.jpg'],
        additionalNotes: 'Check this',
      });

      expect(res.suggestedProductId).toBe('matching-prod-id');
      expect(res.suggestedName).toBe('Roma Tomatoes');
      expect(res.category).toBe(ProductCategory.VEGETABLES);
    });
  });
});
