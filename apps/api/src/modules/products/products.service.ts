import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  ProductCategory,
  HarvestStatus,
  InspectionStatus,
  type InspectionChecklist,
  InspectionChecklistItem,
  type AuthUser,
  type AiSuggestHarvestResponseDto,
  VisitStatus,
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { ProductEntity } from './entities/product.entity';
import { HarvestEntity } from './entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { ParcelEntity } from '../users/entities/parcel.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { InspectionCenterEntity } from '../inspections/entities/inspection-center.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { InspectionPhotoEntity } from '../inspections/entities/inspection-photo.entity';
import { VisitEntity } from '../visits/entities/visit.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { CreateHarvestProxyDto } from './dto/create-harvest-proxy.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { VerifyHarvestDto } from './dto/verify-harvest.dto';

const DEFAULT_CHECKLIST: InspectionChecklist = {
  [InspectionChecklistItem.VISUAL_QUALITY]: {
    passed: true,
    notes: 'Aspect visuel conforme et frais',
  },
  [InspectionChecklistItem.MICROBIAL_COUNT]: {
    passed: true,
    notes: 'Aucune trace de moisissure ou contamination',
  },
  [InspectionChecklistItem.WEIGHT_CALIBRATION]: {
    passed: true,
    notes: 'Poids et calibre conformes aux spécifications',
  },
  [InspectionChecklistItem.PACKAGING]: {
    passed: true,
    notes: 'Conditionnement adapté au transport',
  },
  [InspectionChecklistItem.LABELING]: {
    passed: true,
    notes: 'Étiquetage et traçabilité vérifiés',
  },
};

export function parseCoordinates(
  coordStr: string | null | undefined,
): { lat: number; lon: number } | null {
  if (!coordStr) return null;
  const trimmed = coordStr.trim();
  try {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const lat = Number(parsed[0]);
        const lon = Number(parsed[1]);
        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
      } else if (parsed && typeof parsed === 'object') {
        const lat = Number(parsed.lat ?? parsed.latitude);
        const lon = Number(parsed.lon ?? parsed.lng ?? parsed.longitude);
        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
      }
    } else if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
        return { lat: parts[0]!, lon: parts[1]! };
      }
    }
  } catch {
    return null;
  }

  const parts = trimmed.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
    return { lat: parts[0]!, lon: parts[1]! };
  }
  return null;
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepository: Repository<HarvestEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepository: Repository<FarmerProfileEntity>,
    @InjectRepository(ParcelEntity)
    private readonly parcelRepository: Repository<ParcelEntity>,
    @InjectRepository(InspectionCenterEntity)
    private readonly inspectionCenterRepository: Repository<InspectionCenterEntity>,
    @InjectRepository(InspectorProfileEntity)
    private readonly inspectorProfileRepository: Repository<InspectorProfileEntity>,
    @InjectRepository(InspectionReportEntity)
    private readonly inspectionReportRepository: Repository<InspectionReportEntity>,
    @InjectRepository(InspectionPhotoEntity)
    private readonly inspectionPhotoRepository: Repository<InspectionPhotoEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepository: Repository<VisitEntity>,
    private readonly configService: ConfigService,
    @Optional()
    private readonly currenciesService?: CurrenciesService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly storageService?: StorageService,
  ) {}

  /**
   * Hydrates harvest photos, avatar and banner URLs with valid signed URLs
   */
  async hydrateHarvest(harvest: HarvestEntity): Promise<HarvestEntity> {
    if (!harvest) return harvest;
    if (this.storageService) {
      if (harvest.photoUrls && Array.isArray(harvest.photoUrls) && harvest.photoUrls.length > 0) {
        harvest.photoUrls = await Promise.all(
          harvest.photoUrls.map((p) => this.storageService!.getSignedUrl(p)),
        );
      }
      if (harvest.farmerProfile?.avatarUrl) {
        harvest.farmerProfile.avatarUrl = await this.storageService.getSignedUrl(
          harvest.farmerProfile.avatarUrl,
        );
      }
      if (harvest.farmerProfile?.bannerUrl) {
        harvest.farmerProfile.bannerUrl = await this.storageService.getSignedUrl(
          harvest.farmerProfile.bannerUrl,
        );
      }
      if (harvest.farmerProfile?.user?.avatarUrl) {
        harvest.farmerProfile.user.avatarUrl = await this.storageService.getSignedUrl(
          harvest.farmerProfile.user.avatarUrl,
        );
      }
    }
    return harvest;
  }

  /**
   * Hydrates an array of harvests concurrently
   */
  async hydrateHarvests(harvests: HarvestEntity[]): Promise<HarvestEntity[]> {
    if (!harvests || !this.storageService) return harvests;
    return Promise.all(harvests.map((h) => this.hydrateHarvest(h)));
  }

  // =============================================================================
  // Product Crop Templates
  // =============================================================================

  async createProduct(dto: CreateProductDto): Promise<ProductEntity> {
    const existing = await this.productRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Product template with name "${dto.name}" already exists.`,
      );
    }

    const product = this.productRepository.create(dto);
    return this.productRepository.save(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product template with ID ${id} not found`);
    }
    if (dto.name !== undefined) {
      const existing = await this.productRepository.findOne({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          `Product template with name "${dto.name}" already exists.`,
        );
      }
      product.name = dto.name;
    }
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.category !== undefined) product.category = dto.category;
    return this.productRepository.save(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product template with ID ${id} not found`);
    }
    await this.productRepository.remove(product);
  }

  async findFarmerOwnHarvests(userId: string): Promise<HarvestEntity[]> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Farmer profile not found');
    }
    return this.findAllHarvests({
      farmerProfileId: profile.id,
      isPublicView: false,
    });
  }

  async findAllProducts(category?: ProductCategory): Promise<ProductEntity[]> {
    const query = this.productRepository.createQueryBuilder('product');
    if (category) {
      query.where('product.category = :category', { category });
    }
    return query.orderBy('product.name', 'ASC').getMany();
  }

  async findProductById(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(
        `Product template with ID "${id}" not found.`,
      );
    }
    return product;
  }

  // =============================================================================
  // Harvest Batches
  // =============================================================================

  private async validateInspectorRegionalAccess(
    actorUserId: string,
    targetFarmerProfile: FarmerProfileEntity,
  ): Promise<void> {
    const inspectorProfile = await this.inspectorProfileRepository.findOne({
      where: { userId: actorUserId },
      relations: ['assignments', 'assignments.center'],
    });
    if (inspectorProfile) {
      const activeAssignments = inspectorProfile.assignments?.filter(
        (a) => a.isCurrentAssignment && a.center?.isActive,
      ) || [];
      const assignedRegions = Array.from(
        new Set(activeAssignments.map((a) => a.center.regionName).filter(Boolean)),
      );
      if (assignedRegions.length === 0) {
        throw new ForbiddenException(
          "Vous devez être affecté à au moins un centre d'inspection actif pour agir au nom d'un producteur.",
        );
      }
      const farmerRegion = targetFarmerProfile.regionName?.trim();
      const isAllowed =
        farmerRegion &&
        assignedRegions.some(
          (r) => r.toLowerCase() === farmerRegion.toLowerCase(),
        );
      if (!isAllowed) {
        throw new ForbiddenException(
          `Vous ne pouvez enregistrer ou modifier des récoltes que pour les producteurs situés dans vos régions assignées (${assignedRegions.join(', ')}).`,
        );
      }
    }
  }

  async createHarvest(
    userId: string,
    dto: CreateHarvestDto,
    options?: { onBehalfOfUserId?: string },
  ): Promise<HarvestEntity> {
    const targetUserId = options?.onBehalfOfUserId ?? userId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException(
        'Only registered farmers can create harvest listings.',
      );
    }

    if (options?.onBehalfOfUserId && options.onBehalfOfUserId !== userId) {
      await this.validateInspectorRegionalAccess(userId, farmerProfile);
    }

    const product = await this.findProductById(dto.productId);

    // If parcel is provided, verify it belongs to this farmer profile
    if (dto.parcelId) {
      const parcel = await this.parcelRepository.findOne({
        where: { id: dto.parcelId },
      });
      if (!parcel) {
        throw new NotFoundException(
          `Specified parcel with ID "${dto.parcelId}" not found.`,
        );
      }
      if (parcel.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException(
          'The specified land parcel does not belong to the farmer profile.',
        );
      }
    }

    const targetCurrency = dto.currency || 'CDF';
    let currency = 'CDF';
    let exchangeRate = 2300.0;
    if (this.currenciesService) {
      const snap = await this.currenciesService.getRateSnapshot(targetCurrency);
      currency = snap.currency;
      exchangeRate = snap.exchangeRate;
    }
    const pricePerUnitUSD = Number((dto.pricePerUnit / exchangeRate).toFixed(2));

    const harvest = this.harvestRepository.create({
      ...dto,
      currency,
      exchangeRate,
      pricePerUnitUSD,
      farmerProfileId: farmerProfile.id,
      status: HarvestStatus.PENDING_APPROVAL,
    });

    const savedHarvest = await this.harvestRepository.save(harvest);

    // Dispatch in-app and email notification to inspectors assigned to farmer's region
    if (!options?.onBehalfOfUserId || options.onBehalfOfUserId === userId) {
      void this.notifyRegionalInspectors(farmerProfile, product, savedHarvest);
    }

    return this.hydrateHarvest(savedHarvest);
  }

  private async notifyRegionalInspectors(
    farmerProfile: FarmerProfileEntity,
    product: ProductEntity,
    harvest: HarvestEntity,
  ): Promise<void> {
    if (!this.notificationsService) return;
    const farmerRegion = farmerProfile.regionName?.trim();
    if (!farmerRegion) return;

    try {
      const inspectorProfiles = await this.inspectorProfileRepository.find({
        where: { isActiveInspector: true },
        relations: ['assignments', 'assignments.center'],
      });

      const regionalInspectorUserIds = inspectorProfiles
        .filter((ip) =>
          ip.assignments?.some(
            (a) =>
              a.isCurrentAssignment &&
              a.center?.isActive &&
              a.center.regionName?.trim().toLowerCase() ===
                farmerRegion.toLowerCase(),
          ),
        )
        .map((ip) => ip.userId)
        .filter(Boolean);

      if (regionalInspectorUserIds.length > 0) {
        await this.notificationsService.send({
          recipientIds: regionalInspectorUserIds,
          title: 'Nouvelle récolte soumise',
          body: `Le producteur ${farmerProfile.companyName || 'agricole'} a soumis une nouvelle récolte de ${product.name} (${harvest.quantityInStock} ${harvest.unit}) dans votre région (${farmerRegion}).`,
          channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
          priority: NotificationPriority.HIGH,
          metadata: {
            actionUrl: `/inspector/reports/${harvest.id}`,
            actionText: 'Vérifier la récolte',
            harvestId: harvest.id,
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to notify regional inspectors for harvest ${harvest.id}:`,
        err,
      );
    }
  }

  async createHarvestProxy(
    actorUserId: string,
    dto: CreateHarvestProxyDto,
  ): Promise<HarvestEntity> {
    const targetUserId = dto.farmerUserId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException(
        'Only registered farmers can have harvest listings created.',
      );
    }

    await this.validateInspectorRegionalAccess(actorUserId, farmerProfile);

    // Resolve or dynamically create Product template
    let product: ProductEntity | null = null;
    if (dto.productId) {
      product = await this.productRepository.findOne({
        where: { id: dto.productId },
      });
    }
    if (!product && dto.productName?.trim()) {
      const trimmedName = dto.productName.trim();
      product = await this.productRepository
        .createQueryBuilder('product')
        .where('LOWER(product.name) = LOWER(:name)', { name: trimmedName })
        .getOne();
      if (!product) {
        const newProduct = this.productRepository.create({
          name: trimmedName,
          category: ProductCategory.OTHER,
          description: `Variété ${trimmedName} enregistrée sur le terrain`,
        });
        product = await this.productRepository.save(newProduct);
      }
    }
    if (!product) {
      throw new BadRequestException(
        'Veuillez spécifier un produit existant ou renseigner le nom de la variété récoltée.',
      );
    }

    if (dto.parcelId) {
      const parcel = await this.parcelRepository.findOne({
        where: { id: dto.parcelId },
      });
      if (!parcel) {
        throw new NotFoundException(
          `Specified parcel with ID "${dto.parcelId}" not found.`,
        );
      }
      if (parcel.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException(
          'The specified land parcel does not belong to the farmer profile.',
        );
      }
    }

    const qualityScore = dto.qualityScore ?? 8.5;
    const isApproved = qualityScore >= 4.0;
    const status = isApproved
      ? HarvestStatus.APPROVED
      : HarvestStatus.REJECTED;

    const harvest = this.harvestRepository.create({
      productId: product.id,
      parcelId: dto.parcelId ?? null,
      harvestDate: new Date(dto.harvestDate),
      expirationDate: new Date(dto.expirationDate),
      quantityInStock: dto.quantityInStock,
      stockMarge: dto.stockMarge ?? 0,
      pricePerUnit: dto.pricePerUnit,
      unit: dto.unit,
      farmingMethods: dto.farmingMethods ?? 'Culture traditionnelle locale',
      photoUrls: dto.photoUrls ?? [],
      farmerProfileId: farmerProfile.id,
      status,
      qualityScore,
      approvedById: actorUserId,
      approvedAt: new Date(),
      priceDecayConfig: dto.priceDecayConfig ?? null,
    });

    const savedHarvest = await this.harvestRepository.save(harvest);

    // Automatically create and link the official Inspection Report & Photos
    const inspectorProfile = await this.inspectorProfileRepository.findOne({
      where: { userId: actorUserId },
    });
    if (inspectorProfile) {
      const report = this.inspectionReportRepository.create({
        harvestId: savedHarvest.id,
        inspectorProfileId: inspectorProfile.id,
        status: isApproved
          ? InspectionStatus.SUBMITTED
          : InspectionStatus.REJECTED,
        checklist: dto.checklist ?? DEFAULT_CHECKLIST,
        overallNotes:
          dto.auditNotes?.trim() ||
          "Inspection physique réalisée sur le terrain lors de l'enregistrement de la récolte",
        siteVisitDate: new Date(dto.harvestDate || Date.now()),
        finalQualityScore: qualityScore,
        submittedAt: new Date(),
      });
      const savedReport = await this.inspectionReportRepository.save(report);

      if (dto.photoUrls && dto.photoUrls.length > 0) {
        const photoEntities = dto.photoUrls.map((url) =>
          this.inspectionPhotoRepository.create({
            inspectionReportId: savedReport.id,
            url,
            takenAt: new Date(),
          }),
        );
        await this.inspectionPhotoRepository.save(photoEntities);
      }
    }

    if (this.notificationsService && farmerProfile.userId) {
      try {
        const qualityText = ` avec une note de qualité de ${qualityScore}/10`;
        await this.notificationsService.send({
          recipientIds: [farmerProfile.userId],
          title: isApproved ? 'Récolte certifiée et enregistrée !' : 'Récolte enregistrée (non validée)',
          body: isApproved
            ? `Votre lot de ${product.name} (${savedHarvest.quantityInStock} ${savedHarvest.unit}) a été enregistré et certifié sur le terrain${qualityText}.`
            : `Votre lot de ${product.name} a été enregistré sur le terrain mais n'a pas atteint le score de qualité requis.`,
          channels: [
            NotificationChannel.DATABASE,
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
          ],
          priority: NotificationPriority.HIGH,
          metadata: {
            actionUrl: `/farmer/products/${savedHarvest.productId || savedHarvest.id}`,
            actionText: 'Voir le produit',
            harvestId: savedHarvest.id,
            productId: savedHarvest.productId,
          },
        });
      } catch (err) {
        this.logger.warn('Failed to send proxy harvest notification:', err);
      }
    }

    return this.hydrateHarvest(savedHarvest);
  }

  async updateHarvest(
    id: string,
    userId: string,
    dto: UpdateHarvestDto,
    options?: { onBehalfOfUserId?: string },
  ): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const targetUserId = options?.onBehalfOfUserId ?? userId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile || harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException('You do not own this harvest batch.');
    }

    const isProxy = !!(options?.onBehalfOfUserId && options.onBehalfOfUserId !== userId);
    if (isProxy) {
      await this.validateInspectorRegionalAccess(userId, farmerProfile);
    }

    if (dto.currency || dto.pricePerUnit !== undefined) {
      const targetCurrency = dto.currency || harvest.currency || 'CDF';
      let exchangeRate = harvest.exchangeRate || 2300.0;
      if (this.currenciesService && dto.currency) {
        const snap = await this.currenciesService.getRateSnapshot(targetCurrency);
        harvest.currency = snap.currency;
        harvest.exchangeRate = snap.exchangeRate;
        exchangeRate = snap.exchangeRate;
      }
      const price = dto.pricePerUnit !== undefined ? dto.pricePerUnit : harvest.pricePerUnit;
      harvest.pricePerUnitUSD = Number((price / exchangeRate).toFixed(2));
    }

    // Only reset status to PENDING_APPROVAL when a farmer directly modifies their batch.
    // When an inspector adjusts details via proxy during inspection/audit, preserve the current status (e.g. FLAGGED_PHYSICAL).
    const newStatus = isProxy ? harvest.status : HarvestStatus.PENDING_APPROVAL;
    Object.assign(harvest, {
      ...dto,
      status: newStatus,
      approvedById: isProxy ? harvest.approvedById : null,
      approvedAt: isProxy ? harvest.approvedAt : null,
      rejectionReason: isProxy ? harvest.rejectionReason : null,
    });

    const savedHarvest = await this.harvestRepository.save(harvest);
    return this.hydrateHarvest(savedHarvest);
  }

  async findHarvestById(id: string): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({
      where: { id },
      relations: ['product', 'farmerProfile', 'farmerProfile.user', 'parcel'],
    });

    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }
    return this.hydrateHarvest(harvest);
  }

  async deleteHarvest(
    id: string,
    userId: string,
    options?: { onBehalfOfUserId?: string },
  ): Promise<void> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const targetUserId = options?.onBehalfOfUserId ?? userId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile || harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException('You do not own this harvest batch.');
    }

    if (options?.onBehalfOfUserId && options.onBehalfOfUserId !== userId) {
      await this.validateInspectorRegionalAccess(userId, farmerProfile);
    }

    // Archive instead of hard delete
    harvest.status = HarvestStatus.ARCHIVED;
    await this.harvestRepository.save(harvest);
  }

  async findAllHarvests(
    options: {
      status?: HarvestStatus | undefined;
      category?: ProductCategory | undefined;
      productId?: string | undefined;
      farmerProfileId?: string | undefined;
      isPublicView?: boolean | undefined;
      centerId?: string | undefined;
      radiusKm?: number | undefined;
    },
    user?: AuthUser,
  ): Promise<HarvestEntity[]> {
    const qb = this.harvestRepository.createQueryBuilder('harvest');
    qb.leftJoinAndSelect('harvest.product', 'product');
    qb.leftJoinAndSelect('harvest.farmerProfile', 'farmerProfile');
    qb.leftJoinAndSelect('farmerProfile.user', 'farmerUser');
    qb.leftJoinAndSelect('harvest.parcel', 'parcel');
    qb.leftJoinAndSelect('farmerProfile.parcels', 'farmerParcels');

    if (options.isPublicView) {
      // Public search only sees approved items
      qb.andWhere('harvest.status = :approvedStatus', {
        approvedStatus: HarvestStatus.APPROVED,
      });
    } else if (options.status) {
      qb.andWhere('harvest.status = :status', { status: options.status });
    } else {
      // Default exclude archived from general admin list unless specifically requested
      qb.andWhere('harvest.status != :archivedStatus', {
        archivedStatus: HarvestStatus.ARCHIVED,
      });
    }

    if (options.category) {
      qb.andWhere('product.category = :category', {
        category: options.category,
      });
    }

    if (options.productId) {
      qb.andWhere('harvest.product_id = :productId', {
        productId: options.productId,
      });
    }

    if (options.farmerProfileId) {
      qb.andWhere('harvest.farmer_profile_id = :farmerProfileId', {
        farmerProfileId: options.farmerProfileId,
      });
    }

    // Sort order: FIFO (Oldest First ASC) for pending approvals, DESC for general views
    const sortOrder =
      options.status === HarvestStatus.PENDING_APPROVAL ? 'ASC' : 'DESC';
    let harvests = await qb.orderBy('harvest.createdAt', sortOrder).getMany();

    // Regional or Geospatial filtering by inspection center
    if (options.centerId) {
      const center = await this.inspectionCenterRepository.findOne({
        where: { id: options.centerId },
      });
      if (center) {
        const centerLat = center.latitude != null ? Number(center.latitude) : null;
        const centerLon = center.longitude != null ? Number(center.longitude) : null;
        const maxRadius = options.radiusKm ?? 50;

        harvests = harvests.filter((harvest) => {
          // 1. Direct regional match with farmer profile
          if (
            harvest.farmerProfile?.regionName &&
            center.regionName &&
            harvest.farmerProfile.regionName.trim().toLowerCase() === center.regionName.trim().toLowerCase()
          ) {
            return true;
          }

          // 2. Fallback to geospatial Haversine distance
          if (centerLat != null && centerLon != null) {
            let coords = parseCoordinates(harvest.parcel?.locationCoordinates);
            if (!coords && harvest.farmerProfile?.parcels?.length) {
              for (const p of harvest.farmerProfile.parcels) {
                const parsed = parseCoordinates(p.locationCoordinates);
                if (parsed) {
                  coords = parsed;
                  break;
                }
              }
            }

            if (coords) {
              const distance = calculateHaversineDistanceKm(
                centerLat,
                centerLon,
                coords.lat,
                coords.lon,
              );
              return distance <= maxRadius;
            }
          }

          return false;
        });
      }
    } else if (!options.farmerProfileId && user?.id) {
      // If no centerId specified, but the user is an inspector, automatically filter by all assigned center regions
      const inspectorProfile = await this.inspectorProfileRepository.findOne({
        where: { userId: user.id },
        relations: ['assignments', 'assignments.center'],
      });
      if (inspectorProfile && inspectorProfile.assignments?.length) {
        const activeAssignments = inspectorProfile.assignments.filter(
          (a) => a.isCurrentAssignment && a.center?.isActive,
        );
        const assignedRegions = Array.from(
          new Set(
            activeAssignments
              .map((a) => a.center?.regionName)
              .filter(Boolean)
              .map((r) => r!.trim().toLowerCase()),
          ),
        );
        if (assignedRegions.length > 0) {
          harvests = harvests.filter((harvest) => {
            const farmerRegion = harvest.farmerProfile?.regionName?.trim().toLowerCase();
            return farmerRegion && assignedRegions.includes(farmerRegion);
          });
        }
      }
    }

    // Map public views to apply the stock safety margin buffer
    if (options.isPublicView) {
      const mapped = harvests.map((h) => {
        h.quantityInStock = Math.max(
          0,
          Number(h.quantityInStock) - Number(h.stockMarge),
        );
        return h;
      });
      return this.hydrateHarvests(mapped);
    }

    return this.hydrateHarvests(harvests);
  }

  async verifyHarvest(
    id: string,
    inspectorId: string,
    dto: VerifyHarvestDto,
  ): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({
      where: { id },
      relations: ['product', 'farmerProfile'],
    });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    if (harvest.status === HarvestStatus.ARCHIVED) {
      throw new BadRequestException('Cannot verify an archived harvest.');
    }

    harvest.status = dto.status;
    harvest.approvedById = inspectorId;
    harvest.approvedAt = new Date();

    if (dto.status === HarvestStatus.APPROVED) {
      harvest.qualityScore = dto.qualityScore ?? null;
      harvest.rejectionReason = null;
      if (this.visitRepository) {
        try {
          await this.visitRepository.update(
            { harvestId: id, status: VisitStatus.PLANNED },
            { status: VisitStatus.COMPLETED },
          );
        } catch {}
      }
    } else if (dto.status === HarvestStatus.REJECTED) {
      harvest.qualityScore = null;
      harvest.rejectionReason =
        dto.rejectionReason ?? 'Rejected by inspector without comments.';
      if (this.visitRepository) {
        try {
          await this.visitRepository.update(
            { harvestId: id, status: VisitStatus.PLANNED },
            { status: VisitStatus.COMPLETED },
          );
        } catch {}
      }
    } else if (dto.status === HarvestStatus.FLAGGED_PHYSICAL) {
      harvest.qualityScore = dto.qualityScore ?? null;
      harvest.rejectionReason =
        dto.rejectionReason ?? 'Flagged for physical on-site inspection.';
    }

    const savedHarvest = await this.harvestRepository.save(harvest);

    // Send multi-channel notification to farmer
    if (this.notificationsService && harvest.farmerProfile?.userId) {
      try {
        const prodName = harvest.product?.name ?? 'produit';
        if (dto.status === HarvestStatus.APPROVED) {
          const qualityText =
            harvest.qualityScore != null
              ? ` avec une note de qualité de ${harvest.qualityScore}/10`
              : '';
          await this.notificationsService.send({
            recipientIds: [harvest.farmerProfile.userId],
            title: 'Récolte approuvée !',
            body: `Votre lot de ${prodName} (${harvest.quantityInStock} ${harvest.unit}) a été approuvé et certifié${qualityText}. Il est désormais disponible à la vente.`,
            channels: [
              NotificationChannel.DATABASE,
              NotificationChannel.EMAIL,
              NotificationChannel.SMS,
            ],
            priority: NotificationPriority.HIGH,
            metadata: {
              actionUrl: `/farmer/products/${harvest.productId || harvest.id}`,
              actionText: 'Voir le produit',
              harvestId: harvest.id,
              productId: harvest.productId,
            },
          });
        } else if (dto.status === HarvestStatus.REJECTED) {
          const reasonText = harvest.rejectionReason
            ? ` Motif : ${harvest.rejectionReason}`
            : '';
          await this.notificationsService.send({
            recipientIds: [harvest.farmerProfile.userId],
            title: 'Récolte non validée',
            body: `Votre lot de ${prodName} n'a pas été validé par l'inspecteur.${reasonText}`,
            channels: [
              NotificationChannel.DATABASE,
              NotificationChannel.EMAIL,
              NotificationChannel.SMS,
            ],
            priority: NotificationPriority.HIGH,
            metadata: {
              actionUrl: '/farmer/stock',
              actionText: 'Voir mes récoltes',
              harvestId: harvest.id,
              productId: harvest.productId,
            },
          });
        }
      } catch (err) {
        this.logger.warn('Failed to send harvest verification notification:', err);
      }
    }

    return this.hydrateHarvest(savedHarvest);
  }

  // =============================================================================
  // Price Decay & Dynamic Pricing
  // =============================================================================

  async getDecayedPrice(id: string): Promise<{
    basePrice: number;
    decayedPrice: number;
    basePriceUSD: number;
    decayedPriceUSD: number;
    currency: string;
    exchangeRate: number;
    multiplier: number;
    daysRemaining: number;
  }> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const now = new Date();
    const expiration = new Date(harvest.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let multiplier = 1.0;

    if (
      harvest.priceDecayConfig?.decaySteps &&
      harvest.priceDecayConfig.decaySteps.length > 0
    ) {
      // Sort decay steps ascending by daysBeforeExpiration to locate the correct tier
      const sortedSteps = [...harvest.priceDecayConfig.decaySteps].sort(
        (a, b) => a.daysBeforeExpiration - b.daysBeforeExpiration,
      );
      // Find the first step where remaining days are less than or equal to the tier limit
      const matchingStep = sortedSteps.find(
        (step) => diffDays <= step.daysBeforeExpiration,
      );
      if (matchingStep) {
        multiplier = matchingStep.priceMultiplier;
      }
    }

    const basePrice = Number(harvest.pricePerUnit);
    const exchangeRate = Number(harvest.exchangeRate) || 1.0;
    const basePriceUSD = harvest.pricePerUnitUSD !== null && harvest.pricePerUnitUSD !== undefined
      ? Number(harvest.pricePerUnitUSD)
      : Number((basePrice / exchangeRate).toFixed(2));
    const decayedPrice = Number((basePrice * multiplier).toFixed(2));
    const decayedPriceUSD = Number((basePriceUSD * multiplier).toFixed(2));

    return {
      basePrice,
      decayedPrice,
      basePriceUSD,
      decayedPriceUSD,
      currency: harvest.currency || 'USD',
      exchangeRate,
      multiplier,
      daysRemaining: diffDays,
    };
  }

  // =============================================================================
  // AI Suggestions (Gemini)
  // =============================================================================

  async aiSuggest(prompt: string): Promise<AiSuggestHarvestResponseDto> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured.',
      );
    }

    const promptText = `You are an expert universal agricultural assistant and agronomist.
Analyze this description of a crop harvest: "${prompt}".
Accurately identify the exact agricultural crop or produce mentioned, without restraining yourself to any specific preset (e.g., Manioc / Cassava, Bananes Plantain, Maïs, Soja, Gombo, Tomates, Haricots, Arachides, Avocat, Ananas, Piments, Café, Cacao, etc.).

Return a valid JSON object matching this schema:
{
  "suggestedName": "The clean, natural French crop name (e.g. 'Manioc', 'Bananes Plantain', 'Maïs Jaune', 'Tomates Roma', 'Gombo Frais', 'Avocat Hass')",
  "category": "One of: CEREALS, FRUITS, VEGETABLES, DATES, DAIRY, MEAT, OTHER",
  "description": "Commercial description of the crop for marketplace buyers",
  "farmingMethods": "e.g. 'Biologique', 'Conventionnelle', 'Agroécologie', or 'Sous serre'",
  "recommendedShelfLifeDays": 14
}
Respond ONLY with the JSON object. Do not include markdown code block formatting or any other text.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini API error status ${response.status}: ${errorText}`,
        );
      }

      interface GeminiResponse {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }

      const responseData = (await response.json()) as GeminiResponse;
      const textContent =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error('Gemini returned an empty text content.');
      }

      // Safe parse
      let cleanText: string = textContent.trim();
      if (cleanText.startsWith('```')) {
        const lines: string[] = cleanText.split('\n');
        if (lines.length > 0 && lines[0]?.startsWith('```')) {
          lines.shift();
        }
        if (lines.length > 0 && lines[lines.length - 1]?.startsWith('```')) {
          lines.pop();
        }
        cleanText = lines.join('\n').trim();
      }

      const result = JSON.parse(
        cleanText,
      ) as unknown as AiSuggestHarvestResponseDto;

      // Validate category field
      if (!Object.values(ProductCategory).includes(result.category)) {
        result.category = ProductCategory.OTHER;
      }

      // Check if product exists in database or auto-register it
      let matchedProductId: string | null = null;
      let cleanName = (result.suggestedName || '').trim();
      if (cleanName) {
        cleanName = cleanName.slice(0, 150);
        let product = await this.productRepository
          .createQueryBuilder('p')
          .where('LOWER(p.name) = LOWER(:name)', { name: cleanName })
          .getOne();

        if (!product) {
          product = await this.productRepository
            .createQueryBuilder('p')
            .where('LOWER(p.name) LIKE LOWER(:likeName)', {
              likeName: `%${cleanName}%`,
            })
            .orWhere(':name LIKE LOWER(CONCAT(\'%\', p.name, \'%\'))', {
              name: cleanName.toLowerCase(),
            })
            .getOne();
        }

        if (!product) {
          try {
            const newProduct = this.productRepository.create({
              name: cleanName,
              category: result.category,
              description:
                result.description ||
                `Culture ${cleanName} suggérée automatiquement par l'IA.`,
            });
            product = await this.productRepository.save(newProduct);
          } catch {
            product = await this.productRepository.findOne({
              where: { name: cleanName },
            });
          }
        }

        if (product) {
          matchedProductId = product.id;
          result.suggestedName = product.name;
          result.category = product.category;
        }
      }

      result.suggestedProductId = matchedProductId;
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to generate suggestion: ${errMsg}`);
    }
  }
}
