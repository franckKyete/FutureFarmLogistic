import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';

import { VisitStatus, DashboardStatsDto } from '@futurefarm/types';
import { VisitEntity } from './entities/visit.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitFilterDto } from './dto/visit-filter.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepo: Repository<HarvestEntity>,
    @InjectRepository(InspectionReportEntity)
    private readonly inspectionReportRepo: Repository<InspectionReportEntity>,
  ) {}

  // --- CRUD ---

  async create(inspectorId: string, dto: CreateVisitDto) {
    // Validate producer exists
    const producer = await this.userRepo.findOne({
      where: { id: dto.producerId },
    });
    if (!producer) {
      throw new NotFoundException(
        `Producer with ID ${dto.producerId} not found`,
      );
    }

    const visit = this.visitRepo.create({
      inspectorId,
      producerId: dto.producerId,
      plannedDate: new Date(dto.plannedDate),
      plannedTime: dto.plannedTime || null,
      reason: dto.reason,
      notes: dto.notes || null,
      status: VisitStatus.PLANNED,
    });

    return this.visitRepo.save(visit);
  }

  async findAll(query: VisitFilterDto, inspectorId: string) {
    const where: FindOptionsWhere<VisitEntity> = { inspectorId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.producerId) {
      where.producerId = query.producerId;
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
      relations: ['producer'],
      order: { plannedDate: 'DESC' },
    });

    return visits.map((v) => ({
      id: v.id,
      inspectorId: v.inspectorId,
      producerId: v.producerId,
      plannedDate: v.plannedDate.toISOString(),
      ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
      reason: v.reason,
      status: v.status,
      ...(v.notes ? { notes: v.notes } : {}),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      ...(v.producer
        ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
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

    return this.visitRepo.save(visit);
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
    return this.visitRepo.save(visit);
  }

  // --- Today's visits ---

  async getTodayVisits(inspectorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visits = await this.visitRepo.find({
      where: {
        inspectorId,
        plannedDate: today as any,
        status: VisitStatus.PLANNED,
      },
      relations: ['producer'],
      order: { plannedTime: 'ASC' },
    });

    return visits.map((v) => ({
      id: v.id,
      inspectorId: v.inspectorId,
      producerId: v.producerId,
      plannedDate: v.plannedDate.toISOString(),
      ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
      reason: v.reason,
      status: v.status,
      ...(v.notes ? { notes: v.notes } : {}),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      ...(v.producer
        ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
        : {}),
    }));
  }

  // --- Dashboard Stats ---

  async getDashboardStats(inspectorId: string): Promise<DashboardStatsDto> {
    const today = new Date().toISOString().split('T')[0];

    // Pending farmer accounts
    const [pendingAccountsRow] = await this.userRepo.query(
      `SELECT COUNT(*)::int as count FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'Farmer' AND u.status = 'pending_validation'`,
    );

    // Pending harvest approvals
    const [pendingHarvestsRow] = await this.harvestRepo.query(
      `SELECT COUNT(*)::int as count FROM harvests WHERE status = 'PENDING_APPROVAL'`,
    );

    // Today's visits count
    const [todayVisitsCountRow] = await this.visitRepo.query(
      `SELECT COUNT(*)::int as count FROM visits
       WHERE inspector_id = $1 AND planned_date = $2`,
      [inspectorId, today],
    );

    // Monthly validations (inspection reports submitted this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const [monthlyValidationsRow] = await this.inspectionReportRepo.query(
      `SELECT COUNT(*)::int as count FROM inspection_reports
       WHERE submitted_at >= $1 AND submitted_at < $2`,
      [startOfMonth.toISOString(), endOfMonth.toISOString()],
    );

    // Overdue visits (past planned_date, still PLANNED)
    const [overdueVisitsRow] = await this.visitRepo.query(
      `SELECT COUNT(*)::int as count FROM visits
       WHERE inspector_id = $1 AND planned_date < $2 AND status = 'PLANNED'`,
      [inspectorId, today],
    );

    // Suspicious harvests (quality_score < 4)
    const [suspiciousHarvestsRow] = await this.harvestRepo.query(
      `SELECT COUNT(*)::int as count FROM harvests
       WHERE quality_score IS NOT NULL AND quality_score < 4`,
    );

    // Today's visits list
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayVisits = await this.visitRepo.find({
      where: {
        inspectorId,
        plannedDate: todayDate as any,
      },
      relations: ['producer'],
      order: { plannedTime: 'ASC' },
    });

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
      pendingAccountsCount: pendingAccountsRow.count,
      pendingHarvestsCount: pendingHarvestsRow.count,
      todayVisitsCount: todayVisitsCountRow.count,
      monthlyValidationsCount: monthlyValidationsRow.count,
      priorityAlerts: {
        overdueVisits: overdueVisitsRow.count,
        suspiciousHarvests: suspiciousHarvestsRow.count,
      },
      todayVisits: todayVisits.map((v) => ({
        id: v.id,
        inspectorId: v.inspectorId,
        producerId: v.producerId,
        plannedDate: v.plannedDate.toISOString(),
        ...(v.plannedTime ? { plannedTime: v.plannedTime } : {}),
        reason: v.reason,
        status: v.status,
        ...(v.notes ? { notes: v.notes } : {}),
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        ...(v.producer
          ? { producerName: `${v.producer.firstName} ${v.producer.lastName}` }
          : {}),
      })),
      weeklyStats: weeklyRows.map((r: { planned_date: string; count: number }) => ({
        day: r.planned_date,
        count: r.count,
      })),
    };
  }
}
