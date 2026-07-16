import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CreateInspectorProfileDto,
  CreateInspectionReportDto,
  UpdateInspectionReportDto,
  SubmitInspectionReportDto,
  CreateInspectionPhotoDto,
  AiClassifyHarvestDto,
  AiClassifyHarvestResponseDto,
  InspectionStatus,
  HarvestStatus,
} from '@futurefarm/types';

import { InspectorProfileEntity } from './entities/inspector-profile.entity';
import { InspectionReportEntity } from './entities/inspection-report.entity';
import { InspectionPhotoEntity } from './entities/inspection-photo.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { QualityVisionProvider } from './interfaces/quality-vision-provider.interface';

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(InspectorProfileEntity)
    private readonly inspectorProfileRepo: Repository<InspectorProfileEntity>,
    @InjectRepository(InspectionReportEntity)
    private readonly reportRepo: Repository<InspectionReportEntity>,
    @InjectRepository(InspectionPhotoEntity)
    private readonly photoRepo: Repository<InspectionPhotoEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepo: Repository<HarvestEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @Inject('QUALITY_VISION_PROVIDER')
    private readonly visionProvider: QualityVisionProvider,
    private readonly configService: ConfigService,
  ) {}

  // --- Inspector Profile Management ---

  async createInspectorProfile(
    userId: string,
    dto: CreateInspectorProfileDto,
  ): Promise<InspectorProfileEntity> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const existing = await this.inspectorProfileRepo.findOne({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('User already has an inspector profile');
    }

    const profile = this.inspectorProfileRepo.create({
      userId,
      licenseNumber: dto.licenseNumber,
      agencyName: dto.agencyName,
      specializations: dto.specializations,
      isActiveInspector: true,
    });

    return this.inspectorProfileRepo.save(profile);
  }

  async getInspectorProfile(userId: string): Promise<InspectorProfileEntity> {
    const profile = await this.inspectorProfileRepo.findOne({
      where: { userId, isActiveInspector: true },
    });
    if (!profile) {
      throw new NotFoundException('Active inspector profile not found');
    }
    return profile;
  }

  // --- Inspection Report Lifecycle ---

  async createReport(
    userId: string,
    dto: CreateInspectionReportDto,
  ): Promise<InspectionReportEntity> {
    const profile = await this.getInspectorProfile(userId);

    const harvest = await this.harvestRepo.findOne({
      where: { id: dto.harvestId },
    });
    if (!harvest) {
      throw new NotFoundException(`Harvest with ID ${dto.harvestId} not found`);
    }

    if (harvest.status !== HarvestStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Harvest is not pending approval');
    }

    const report = this.reportRepo.create({
      harvestId: dto.harvestId,
      inspectorProfileId: profile.id,
      status: InspectionStatus.IN_PROGRESS,
      checklist: dto.checklist,
      siteVisitDate: new Date(dto.siteVisitDate),
      photos: [],
    });

    return this.reportRepo.save(report);
  }

  async getReport(id: string): Promise<InspectionReportEntity> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: [
        'photos',
        'inspectorProfile',
        'harvest',
        'harvest.product',
        'harvest.farmerProfile',
        'harvest.farmerProfile.user',
      ],
    });
    if (!report) {
      throw new NotFoundException(`Inspection report with ID ${id} not found`);
    }
    return report;
  }

  async listReportsForInspector(
    userId: string,
  ): Promise<InspectionReportEntity[]> {
    const profile = await this.getInspectorProfile(userId);
    return this.reportRepo.find({
      where: { inspectorProfileId: profile.id },
      relations: ['photos', 'harvest', 'harvest.product'],
    });
  }

  async listAllReports(): Promise<InspectionReportEntity[]> {
    return this.reportRepo.find({
      relations: [
        'photos',
        'inspectorProfile',
        'harvest',
        'harvest.product',
        'harvest.farmerProfile',
        'harvest.farmerProfile.user',
      ],
    });
  }

  async updateReport(
    id: string,
    userId: string,
    dto: UpdateInspectionReportDto,
  ): Promise<InspectionReportEntity> {
    const report = await this.getReport(id);
    const profile = await this.getInspectorProfile(userId);

    if (report.inspectorProfileId !== profile.id) {
      throw new ForbiddenException(
        'You are not authorized to update this report',
      );
    }

    if (report.status !== InspectionStatus.IN_PROGRESS) {
      throw new BadRequestException('Report is already submitted or rejected');
    }

    if (dto.siteVisitDate) {
      report.siteVisitDate = new Date(dto.siteVisitDate);
    }

    if (dto.overallNotes !== undefined) {
      report.overallNotes = dto.overallNotes;
    }

    if (dto.checklist) {
      report.checklist = {
        ...report.checklist,
        ...dto.checklist,
      };
    }

    return this.reportRepo.save(report);
  }

  async addPhoto(
    reportId: string,
    userId: string,
    dto: CreateInspectionPhotoDto,
  ): Promise<InspectionPhotoEntity> {
    const report = await this.getReport(reportId);
    const profile = await this.getInspectorProfile(userId);

    if (report.inspectorProfileId !== profile.id) {
      throw new ForbiddenException(
        'You are not authorized to add photos to this report',
      );
    }

    if (report.status !== InspectionStatus.IN_PROGRESS) {
      throw new BadRequestException('Report is already finalized');
    }

    const photo = this.photoRepo.create({
      inspectionReportId: reportId,
      url: dto.url,
      size: dto.size || null,
      takenAt: dto.takenAt ? new Date(dto.takenAt) : null,
      latitude: dto.latitude || null,
      longitude: dto.longitude || null,
    });

    return this.photoRepo.save(photo);
  }

  async removePhoto(
    reportId: string,
    photoId: string,
    userId: string,
  ): Promise<void> {
    const report = await this.getReport(reportId);
    const profile = await this.getInspectorProfile(userId);

    if (report.inspectorProfileId !== profile.id) {
      throw new ForbiddenException(
        'You are not authorized to remove photos from this report',
      );
    }

    if (report.status !== InspectionStatus.IN_PROGRESS) {
      throw new BadRequestException('Report is already finalized');
    }

    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo || photo.inspectionReportId !== reportId) {
      throw new NotFoundException(`Photo not found in report ${reportId}`);
    }

    await this.photoRepo.remove(photo);
  }

  async runAiPreScreen(
    id: string,
    userId: string,
  ): Promise<InspectionReportEntity> {
    const report = await this.getReport(id);
    const profile = await this.getInspectorProfile(userId);

    if (report.inspectorProfileId !== profile.id) {
      throw new ForbiddenException(
        'You are not authorized to trigger AI screening on this report',
      );
    }

    if (report.status !== InspectionStatus.IN_PROGRESS) {
      throw new BadRequestException('Report is already finalized');
    }

    // Determine the source of photos: prioritize report photos, fallback to harvest photos
    let photoUrls = report.photos.map((p) => p.url);
    if (photoUrls.length === 0) {
      const harvest = await this.harvestRepo.findOne({
        where: { id: report.harvestId },
      });
      if (harvest && harvest.photoUrls) {
        photoUrls = harvest.photoUrls;
      }
    }

    if (photoUrls.length === 0) {
      throw new BadRequestException(
        'No photos available on this report or harvest to analyze',
      );
    }

    const analysis = await this.visionProvider.analyzeHarvestPhotos(photoUrls);

    report.aiPreScreenScore = analysis.suggestedScore;
    report.aiPreScreenNotes = `Detected Defects: ${analysis.detectedDefects.join(
      ', ',
    )}. Notes: ${analysis.analysisNotes}`;

    return this.reportRepo.save(report);
  }

  async submitReport(
    id: string,
    userId: string,
    dto: SubmitInspectionReportDto,
  ): Promise<InspectionReportEntity> {
    const report = await this.getReport(id);
    const profile = await this.getInspectorProfile(userId);

    if (report.inspectorProfileId !== profile.id) {
      throw new ForbiddenException(
        'You are not authorized to submit this report',
      );
    }

    if (report.status !== InspectionStatus.IN_PROGRESS) {
      throw new BadRequestException('Report is already submitted');
    }

    if (dto.checklist) {
      report.checklist = dto.checklist;
    }

    if (dto.overallNotes) {
      report.overallNotes = dto.overallNotes;
    }

    report.finalQualityScore = dto.finalQualityScore;
    report.submittedAt = new Date();

    const minScore = this.configService.get<number>('HARVEST_APPROVAL_MIN_SCORE', 4.0);
    const isApproved = dto.finalQualityScore >= minScore;
    report.status = isApproved
      ? InspectionStatus.SUBMITTED
      : InspectionStatus.REJECTED;

    // Mutate parent harvest batch
    const harvest = await this.harvestRepo.findOne({
      where: { id: report.harvestId },
    });
    if (!harvest) {
      throw new NotFoundException(`Harvest associated with report not found`);
    }

    harvest.qualityScore = dto.finalQualityScore;
    harvest.status = isApproved
      ? HarvestStatus.APPROVED
      : HarvestStatus.REJECTED;
    harvest.approvedById = userId;
    harvest.approvedAt = new Date();
    if (!isApproved) {
      harvest.rejectionReason =
        dto.overallNotes || 'Failed quality inspection score thresholds';
    }

    await this.harvestRepo.save(harvest);
    return this.reportRepo.save(report);
  }

  // --- AI Crop Classification & Pre-Fill ---

  async classifyHarvest(
    dto: AiClassifyHarvestDto,
  ): Promise<AiClassifyHarvestResponseDto> {
    if (!dto.photoUrls || dto.photoUrls.length === 0) {
      throw new BadRequestException(
        'Must provide at least one photo URL for classification',
      );
    }

    // Trigger classification with vision provider
    const classification = await this.visionProvider.classifyHarvestPhotos(
      dto.photoUrls,
      dto.additionalNotes,
    );

    // Search database for matching crop template (ProductEntity)
    let matchedProductId: string | null = null;
    const cleanName = classification.suggestedName.trim();
    if (cleanName) {
      const product = await this.productRepo
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: cleanName })
        .orWhere('LOWER(p.name) LIKE LOWER(:likeName)', {
          likeName: `%${cleanName}%`,
        })
        .getOne();

      if (product) {
        matchedProductId = product.id;
      }
    }

    return {
      suggestedProductId: matchedProductId,
      suggestedName: classification.suggestedName,
      category: classification.category,
      description: classification.description,
      farmingMethods: classification.farmingMethods,
      recommendedShelfLifeDays: classification.recommendedShelfLifeDays,
      estimatedQuantity: classification.estimatedQuantity,
      suggestedPricePerUnit: classification.suggestedPricePerUnit,
      aiQualityScore: classification.aiQualityScore,
    };
  }
}
