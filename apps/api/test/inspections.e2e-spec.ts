/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

import { Permission, InspectionStatus, HarvestStatus } from '@futurefarm/types';
import { AppModule } from '../src/app.module';
import { InspectorProfileEntity } from '../src/modules/inspections/entities/inspector-profile.entity';
import { InspectionReportEntity } from '../src/modules/inspections/entities/inspection-report.entity';
import { InspectionPhotoEntity } from '../src/modules/inspections/entities/inspection-photo.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { HarvestEntity } from '../src/modules/products/entities/harvest.entity';
import { ProductEntity } from '../src/modules/products/entities/product.entity';
import { SeedService } from '../src/database/seed.service';
import { getQueueToken } from '@nestjs/bull';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

describe('Inspections (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockInspectorProfileRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInspectionReportRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInspectionPhotoRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockHarvestRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockProductRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    client: {
      on: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(InspectorProfileEntity))
      .useValue(mockInspectorProfileRepo)
      .overrideProvider(getRepositoryToken(InspectionReportEntity))
      .useValue(mockInspectionReportRepo)
      .overrideProvider(getRepositoryToken(InspectionPhotoEntity))
      .useValue(mockInspectionPhotoRepo)
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(mockUserRepo)
      .overrideProvider(getRepositoryToken(HarvestEntity))
      .useValue(mockHarvestRepo)
      .overrideProvider(getRepositoryToken(ProductEntity))
      .useValue(mockProductRepo)
      .overrideProvider(getQueueToken('notifications'))
      .useValue(mockQueue)
      .overrideProvider(SeedService)
      .useValue({
        onApplicationBootstrap: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/inspections/profile', () => {
    it('should create inspector profile successfully', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'inspector@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.INSPECTOR_PROFILE_UPDATE] }],
      });
      mockInspectorProfileRepo.findOne.mockResolvedValue(null);
      mockInspectorProfileRepo.create.mockReturnValue({
        licenseNumber: 'L-777',
      });
      mockInspectorProfileRepo.save.mockResolvedValue({
        id: 'prof-id',
        licenseNumber: 'L-777',
      });

      const response = await request(app.getHttpServer())
        .post('/v1/inspections/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: 'L-777',
          agencyName: 'Agency X',
          specializations: ['DATES'],
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'prof-id');
    });
  });

  describe('POST /v1/harvests/ai-classify', () => {
    it('should return 200 and suggested pre-fill parameters', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'farmer@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [{ permissions: [Permission.HARVEST_CREATE] }],
      });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ id: 'matched-prod-id', name: 'Roma Tomatoes' }),
      };
      mockProductRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const response = await request(app.getHttpServer())
        .post('/v1/harvests/ai-classify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          photoUrls: ['http://example.com/photo.jpg'],
          additionalNotes: 'Red tomatoes harvested today',
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('suggestedName');
      expect(response.body.data).toHaveProperty('category');
    });
  });

  describe('POST /v1/inspections/reports', () => {
    it('should create an inspection report', async () => {
      const token = jwtService.sign({
        sub: 'user-id',
        email: 'inspector@test.com',
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        roles: [
          {
            permissions: [
              Permission.INSPECTION_CREATE,
              Permission.INSPECTOR_PROFILE_READ,
            ],
          },
        ],
      });
      mockInspectorProfileRepo.findOne.mockResolvedValue({
        id: 'prof-id',
        isActiveInspector: true,
      });
      mockHarvestRepo.findOne.mockResolvedValue({
        id: 'harvest-id',
        status: HarvestStatus.PENDING_APPROVAL,
      });
      mockInspectionReportRepo.create.mockReturnValue({ id: 'report-id' });
      mockInspectionReportRepo.save.mockResolvedValue({
        id: 'report-id',
        status: InspectionStatus.IN_PROGRESS,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/inspections/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          harvestId: 'harvest-id',
          siteVisitDate: '2026-07-04',
          checklist: {
            VISUAL_QUALITY: { passed: true, notes: 'Good' },
            MICROBIAL_COUNT: { passed: true, notes: 'Clear' },
            WEIGHT_CALIBRATION: { passed: true, notes: 'Ok' },
            PACKAGING: { passed: true, notes: 'Intact' },
            LABELING: { passed: true, notes: 'Correct' },
          },
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id', 'report-id');
    });
  });
});
