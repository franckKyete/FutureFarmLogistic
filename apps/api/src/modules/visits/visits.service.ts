import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';

import {
  VisitStatus,
  DashboardStatsDto,
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';
import { NotificationsService } from '../notifications/notifications.service';
import { VisitEntity } from './entities/visit.entity';
import { UserEntity } from '../users/entities/user.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitFilterDto } from './dto/visit-filter.dto';

function formatDateString(date: string | Date | unknown): string {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.split('T')[0] ?? '';
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0] ?? '';
  }
  return String(date).split('T')[0] ?? '';
}

function formatDateIso(date: string | Date | unknown): string {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString();
  }
  return new Date(date as any).toISOString();
}

@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name);

  constructor(
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepo: Repository<FarmerProfileEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepo: Repository<HarvestEntity>,
    @InjectRepository(InspectionReportEntity)
    private readonly inspectionReportRepo: Repository<InspectionReportEntity>,
    @InjectRepository(InspectorProfileEntity)
    private readonly inspectorProfileRepo: Repository<InspectorProfileEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepo: Repository<OrderLineEntity>,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  // --- CRUD ---

  async create(inspectorId: string, dto: CreateVisitDto) {
    let resolvedProducerId = dto.producerId;

    // Validate producer exists - check UserEntity first
    let producer = await this.userRepo.findOne({
      where: { id: resolvedProducerId },
    });

    if (!producer) {
      // Check if producerId is a FarmerProfileEntity id
      const farmerProfile = await this.farmerProfileRepo.findOne({
        where: { id: resolvedProducerId },
        relations: ['user'],
      });
      if (farmerProfile?.user) {
        producer = farmerProfile.user;
        resolvedProducerId = farmerProfile.userId;
      }
    }

    if (!producer) {
      throw new NotFoundException(
        `Producer with ID ${dto.producerId} not found`,
      );
    }

    const visit = this.visitRepo.create({
      inspectorId,
      producerId: resolvedProducerId,
      harvestId: dto.harvestId || null,
      plannedDate: new Date(dto.plannedDate),
      plannedTime: dto.plannedTime || null,
      reason: dto.reason,
      notes: dto.notes || null,
      status: VisitStatus.PLANNED,
    });

    const savedVisit = await this.visitRepo.save(visit);

    if (this.notificationsService && resolvedProducerId) {
      try {
        const dateStr = formatDateString(savedVisit.plannedDate);
        const timeStr = savedVisit.plannedTime ? ` à ${savedVisit.plannedTime}` : '';
        await this.notificationsService.send({
          recipientIds: [resolvedProducerId],
          title: "Nouvelle inspection terrain planifiée",
          body: `Un inspecteur a planifié une visite d'inspection le ${dateStr}${timeStr}.${savedVisit.notes ? ` Remarque : ${savedVisit.notes}` : ''}`,
          channels: [
            NotificationChannel.DATABASE,
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
          ],
          priority: NotificationPriority.HIGH,
          metadata: {
            actionUrl: '/farmer/dashboard',
            visitId: savedVisit.id,
            ...(savedVisit.harvestId ? { harvestId: savedVisit.harvestId } : {}),
          },
        });
      } catch (err) {
        this.logger.warn('Failed to send visit creation notification to farmer:', err);
      }
    }

    return savedVisit;
  }

  async findAll(query: VisitFilterDto, userId: string) {
    const farmerProfile = await this.farmerProfileRepo.findOne({
      where: { userId },
    });

    const where: FindOptionsWhere<VisitEntity> = {};

    if (farmerProfile) {
      where.producerId = userId;
    } else {
      where.inspectorId = userId;
      if (query.producerId) {
        where.producerId = query.producerId;
      }
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.date) {
      where.plannedDate = new Date(query.date) as any;
    }
    if (query.startDate && query.endDate) {
      where.plannedDate = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      ) as any;
    } else if (query.startDate) {
      where.plannedDate = MoreThanOrEqual(new Date(query.startDate)) as any;
    } else if (query.endDate) {
      where.plannedDate = LessThanOrEqual(new Date(query.endDate)) as any;
    }

    const visits = await this.visitRepo.find({
      where,
      relations: ['producer', 'inspector'],
      order: { plannedDate: 'DESC' },
    });

    return visits.map((v) => ({
      id: v.id,
      inspectorId: v.inspectorId,
      producerId: v.producerId,
      ...(v.harvestId ? { harvestId: v.harvestId } : {}),
      plannedDate: formatDateString(v.plannedDate),
      ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
      reason: v.reason,
      status: v.status,
      ...(v.notes ? { notes: v.notes } : {}),
      createdAt: formatDateIso(v.createdAt),
      updatedAt: formatDateIso(v.updatedAt),
      ...(v.producer
        ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
        : {}),
      ...(v.inspector
        ? { inspectorName: `${v.inspector.firstName} ${v.inspector.lastName}` }
        : {}),
    }));
  }

  async findOne(id: string) {
    const visit = await this.visitRepo.findOne({
      where: { id },
      relations: ['producer'],
    });
    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }
    return visit;
  }

  async update(id: string, dto: UpdateVisitDto, inspectorId: string) {
    const visit = await this.visitRepo.findOne({ where: { id } });
    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }
    if (visit.inspectorId !== inspectorId) {
      throw new ForbiddenException('You are not authorized to update this visit');
    }

    if (dto.plannedDate !== undefined) {
      visit.plannedDate = new Date(dto.plannedDate);
    }
    if (dto.plannedTime !== undefined) {
      visit.plannedTime = dto.plannedTime;
    }
    if (dto.notes !== undefined) {
      visit.notes = dto.notes;
    }

    const savedVisit = await this.visitRepo.save(visit);

    if (this.notificationsService && savedVisit.producerId) {
      try {
        const dateStr = formatDateString(savedVisit.plannedDate);
        const timeStr = savedVisit.plannedTime ? ` à ${savedVisit.plannedTime}` : '';
        await this.notificationsService.send({
          recipientIds: [savedVisit.producerId],
          title: "Visite d'inspection reprogrammée",
          body: `Votre visite d'inspection a été reprogrammée pour le ${dateStr}${timeStr}.${savedVisit.notes ? ` Remarque : ${savedVisit.notes}` : ''}`,
          channels: [
            NotificationChannel.DATABASE,
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
          ],
          priority: NotificationPriority.HIGH,
          metadata: {
            actionUrl: '/farmer/dashboard',
            visitId: savedVisit.id,
            ...(savedVisit.harvestId ? { harvestId: savedVisit.harvestId } : {}),
          },
        });
      } catch (err) {
        this.logger.warn('Failed to send visit reschedule notification to farmer:', err);
      }
    }

    return savedVisit;
  }

  async cancel(id: string, inspectorId: string) {
    const visit = await this.visitRepo.findOne({ where: { id } });
    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }
    if (visit.inspectorId !== inspectorId) {
      throw new ForbiddenException('You are not authorized to cancel this visit');
    }

    visit.status = VisitStatus.CANCELLED;
    const savedVisit = await this.visitRepo.save(visit);

    if (this.notificationsService && savedVisit.producerId) {
      try {
        await this.notificationsService.send({
          recipientIds: [savedVisit.producerId],
          title: "Visite d'inspection annulée",
          body: `La visite d'inspection prévue le ${formatDateString(savedVisit.plannedDate)} a été annulée par l'inspecteur.`,
          channels: [
            NotificationChannel.DATABASE,
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
          ],
          priority: NotificationPriority.HIGH,
          metadata: {
            actionUrl: '/farmer/dashboard',
            visitId: savedVisit.id,
          },
        });
      } catch (err) {
        this.logger.warn('Failed to send visit cancellation notification to farmer:', err);
      }
    }

    return savedVisit;
  }

  // --- Today's visits ---

  async getTodayVisits(inspectorId: string) {
    const todayStr = new Date().toISOString().split('T')[0];

    const visits = await this.visitRepo.find({
      where: {
        inspectorId,
        status: VisitStatus.PLANNED,
      },
      relations: ['producer'],
      order: { plannedTime: 'ASC' },
    });

    const filtered = visits.filter(
      (v) => formatDateString(v.plannedDate) === todayStr,
    );

    return filtered.map((v) => ({
      id: v.id,
      inspectorId: v.inspectorId,
      producerId: v.producerId,
      ...(v.harvestId ? { harvestId: v.harvestId } : {}),
      plannedDate: formatDateString(v.plannedDate),
      ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
      reason: v.reason,
      status: v.status,
      ...(v.notes ? { notes: v.notes } : {}),
      createdAt: formatDateIso(v.createdAt),
      updatedAt: formatDateIso(v.updatedAt),
      ...(v.producer
        ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
        : {}),
    }));
  }

  // --- Dashboard Stats ---

  async getDashboardStats(inspectorId: string): Promise<DashboardStatsDto> {
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the inspector's profile and active assigned center(s) / region(s)
    const inspectorProfile = await this.inspectorProfileRepo.findOne({
      where: { userId: inspectorId },
      relations: ['assignments', 'assignments.center'],
    });

    const assignedRegions = (
      inspectorProfile?.assignments
        ?.filter((a) => a.isCurrentAssignment && a.center?.isActive && a.center?.regionName)
        ?.map((a) => a.center.regionName.trim().toLowerCase()) || []
    ).filter((r, idx, arr) => arr.indexOf(r) === idx);

    let regionalFarmersCount = 0;
    let pendingAccountsCount = 0;
    let pendingHarvestsCount = 0;
    let orderVolume = 0;
    let averageQualityScore: number | null = null;
    let suspiciousHarvests = 0;

    if (assignedRegions.length > 0) {
      // Total registered farmers in inspector's assigned region(s)
      const [regionalFarmersRow] = await this.userRepo.query(
        `SELECT COUNT(DISTINCT u.id)::int as count FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         INNER JOIN farmer_profiles fp ON fp.user_id = u.id
         WHERE r.name = 'Farmer' AND LOWER(TRIM(fp.region_name)) = ANY($1)`,
        [assignedRegions],
      );
      regionalFarmersCount = Number(regionalFarmersRow?.count || 0);

      // Pending farmer accounts in inspector's assigned region(s)
      const [pendingAccountsRow] = await this.userRepo.query(
        `SELECT COUNT(DISTINCT u.id)::int as count FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         INNER JOIN farmer_profiles fp ON fp.user_id = u.id
         WHERE r.name = 'Farmer' AND u.status = 'pending_validation' AND LOWER(TRIM(fp.region_name)) = ANY($1)`,
        [assignedRegions],
      );
      pendingAccountsCount = Number(pendingAccountsRow?.count || 0);

      // Pending harvests in inspector's assigned region(s)
      const [pendingHarvestsRow] = await this.harvestRepo.query(
        `SELECT COUNT(*)::int as count FROM harvests h
         INNER JOIN farmer_profiles fp ON fp.id = h.farmer_profile_id
         WHERE h.status = 'PENDING_APPROVAL' AND LOWER(TRIM(fp.region_name)) = ANY($1)`,
        [assignedRegions],
      );
      pendingHarvestsCount = Number(pendingHarvestsRow?.count || 0);

      // Suspicious harvests in inspector's assigned region(s) (quality_score < 4)
      const [suspiciousHarvestsRow] = await this.harvestRepo.query(
        `SELECT COUNT(*)::int as count FROM harvests h
         INNER JOIN farmer_profiles fp ON fp.id = h.farmer_profile_id
         WHERE h.quality_score IS NOT NULL AND h.quality_score < 4 AND LOWER(TRIM(fp.region_name)) = ANY($1)`,
        [assignedRegions],
      );
      suspiciousHarvests = Number(suspiciousHarvestsRow?.count || 0);

      // Average quality score of approved harvests in inspector's assigned region(s)
      const [avgScoreRow] = await this.harvestRepo.query(
        `SELECT AVG(h.quality_score)::numeric(10,1) as avg FROM harvests h
         INNER JOIN farmer_profiles fp ON fp.id = h.farmer_profile_id
         WHERE h.quality_score IS NOT NULL AND h.status = 'APPROVED' AND LOWER(TRIM(fp.region_name)) = ANY($1)`,
        [assignedRegions],
      );
      if (avgScoreRow?.avg != null) {
        averageQualityScore = Number(avgScoreRow.avg);
      }

      // Order volume in inspector's region(s)
      try {
        const [orderVolumeRow] = await this.orderLineRepo.query(
          `SELECT COUNT(DISTINCT ol.order_id)::int as count FROM order_lines ol
           INNER JOIN farmer_profiles fp ON fp.id = ol.farmer_profile_id
           WHERE LOWER(TRIM(fp.region_name)) = ANY($1)`,
          [assignedRegions],
        );
        orderVolume = Number(orderVolumeRow?.count || 0);
      } catch {}
    } else {
      // Fallback if inspector is not yet assigned to a center
      const [pendingAccountsRow] = await this.userRepo.query(
        `SELECT COUNT(*)::int as count FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'Farmer' AND u.status = 'pending_validation'`,
      );
      pendingAccountsCount = Number(pendingAccountsRow?.count || 0);

      const [pendingHarvestsRow] = await this.harvestRepo.query(
        `SELECT COUNT(*)::int as count FROM harvests WHERE status = 'PENDING_APPROVAL'`,
      );
      pendingHarvestsCount = Number(pendingHarvestsRow?.count || 0);

      const [totalFarmersRow] = await this.userRepo.query(
        `SELECT COUNT(*)::int as count FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'Farmer'`,
      );
      regionalFarmersCount = Number(totalFarmersRow?.count || 0);

      const [avgScoreRow] = await this.harvestRepo.query(
        `SELECT AVG(quality_score)::numeric(10,1) as avg FROM harvests
         WHERE quality_score IS NOT NULL AND status = 'APPROVED'`,
      );
      if (avgScoreRow?.avg != null) {
        averageQualityScore = Number(avgScoreRow.avg);
      }

      try {
        const [orderVolumeRow] = await this.orderLineRepo.query(
          `SELECT COUNT(*)::int as count FROM orders`,
        );
        orderVolume = Number(orderVolumeRow?.count || 0);
      } catch {}
    }

    // Today's visits count for this inspector
    const [todayVisitsCountRow] = await this.visitRepo.query(
      `SELECT COUNT(*)::int as count FROM visits
       WHERE inspector_id = $1 AND planned_date = $2`,
      [inspectorId, today],
    );

    // Monthly validations (harvests approved/inspected by this inspector this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const [monthlyValidationsRow] = await this.inspectionReportRepo.query(
      `SELECT COUNT(DISTINCT h.id)::int as count FROM harvests h
       WHERE (h.approved_by_id = $1 AND h.approved_at >= $2 AND h.approved_at < $3)
          OR h.id IN (
            SELECT ir.harvest_id FROM inspection_reports ir
            WHERE ir.inspector_profile_id = $4 AND ir.submitted_at >= $2 AND ir.submitted_at < $3
          )`,
      [
        inspectorId,
        startOfMonth.toISOString(),
        endOfMonth.toISOString(),
        inspectorProfile?.id ?? '00000000-0000-0000-0000-000000000000',
      ],
    );

    // Overdue visits (past planned_date, still PLANNED)
    const [overdueVisitsRow] = await this.visitRepo.query(
      `SELECT COUNT(*)::int as count FROM visits
       WHERE inspector_id = $1 AND planned_date < $2 AND status = 'PLANNED'`,
      [inspectorId, today],
    );

    // Inspector visits list (today & upcoming)
    const inspectorVisits = await this.visitRepo.find({
      where: {
        inspectorId,
      },
      relations: ['producer'],
      order: { plannedDate: 'ASC', plannedTime: 'ASC' },
    });
    const todayVisits = inspectorVisits.filter(
      (v) =>
        formatDateString(v.plannedDate) === today &&
        v.status === VisitStatus.PLANNED,
    );
    const upcomingVisits = inspectorVisits.filter(
      (v) =>
        formatDateString(v.plannedDate) >= today &&
        v.status === VisitStatus.PLANNED,
    );

    // Weekly stats (visits per day for current week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weeklyRows = await this.visitRepo.query(
      `SELECT planned_date::text, COUNT(*)::int as count FROM visits
       WHERE inspector_id = $1 AND planned_date >= $2 AND planned_date < $3
       GROUP BY planned_date ORDER BY planned_date`,
      [
        inspectorId,
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0],
      ],
    );

    return {
      pendingAccountsCount,
      pendingHarvestsCount,
      todayVisitsCount: Number(todayVisitsCountRow?.count || 0),
      monthlyValidationsCount: Number(monthlyValidationsRow?.count || 0),
      regionalFarmersCount,
      orderVolume,
      averageQualityScore: averageQualityScore != null ? Number(averageQualityScore) : null,
      priorityAlerts: {
        overdueVisits: Number(overdueVisitsRow?.count || 0),
        suspiciousHarvests,
      },
      todayVisits: todayVisits.map((v) => ({
        id: v.id,
        inspectorId: v.inspectorId,
        producerId: v.producerId,
        ...(v.harvestId ? { harvestId: v.harvestId } : {}),
        plannedDate: formatDateString(v.plannedDate),
        ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
        reason: v.reason,
        status: v.status,
        ...(v.notes ? { notes: v.notes } : {}),
        createdAt: formatDateIso(v.createdAt),
        updatedAt: formatDateIso(v.updatedAt),
        ...(v.producer
          ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
          : {}),
      })),
      upcomingVisits: upcomingVisits.map((v) => ({
        id: v.id,
        inspectorId: v.inspectorId,
        producerId: v.producerId,
        ...(v.harvestId ? { harvestId: v.harvestId } : {}),
        plannedDate: formatDateString(v.plannedDate),
        ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
        reason: v.reason,
        status: v.status,
        ...(v.notes ? { notes: v.notes } : {}),
        createdAt: formatDateIso(v.createdAt),
        updatedAt: formatDateIso(v.updatedAt),
        ...(v.producer
          ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
          : {}),
      })),
      weeklyStats: weeklyRows.map((r: { planned_date: string; count: number }) => ({
        day: formatDateString(r.planned_date),
        count: Number(r.count),
      })),
    };
  }

  async completeVisitForHarvest(harvestId: string): Promise<void> {
    if (!harvestId) return;
    await this.visitRepo.update(
      { harvestId, status: VisitStatus.PLANNED },
      { status: VisitStatus.COMPLETED },
    );
  }
}
