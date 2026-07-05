import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InspectionCenterEntity } from './entities/inspection-center.entity';
import { InspectorCenterAssignmentEntity } from './entities/inspector-center-assignment.entity';
import { InspectorProfileEntity } from './entities/inspector-profile.entity';
import { CreateInspectionCenterDto, UpdateInspectionCenterDto } from './dto/inspection-center.dto';

@Injectable()
export class InspectionCentersService {
  constructor(
    @InjectRepository(InspectionCenterEntity)
    private readonly centerRepo: Repository<InspectionCenterEntity>,
    @InjectRepository(InspectorCenterAssignmentEntity)
    private readonly assignmentRepo: Repository<InspectorCenterAssignmentEntity>,
    @InjectRepository(InspectorProfileEntity)
    private readonly inspectorProfileRepo: Repository<InspectorProfileEntity>,
  ) {}

  async createCenter(dto: CreateInspectionCenterDto): Promise<InspectionCenterEntity> {
    const existing = await this.centerRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Inspection Center with code "${dto.code}" already exists.`);
    }

    const center = this.centerRepo.create({
      name: dto.name,
      code: dto.code,
      regionName: dto.regionName,
      address: dto.address,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    return this.centerRepo.save(center);
  }

  async listCenters(options?: { regionName?: string; activeOnly?: boolean }): Promise<InspectionCenterEntity[]> {
    const query = this.centerRepo.createQueryBuilder('center');

    if (options?.regionName) {
      query.andWhere('center.regionName = :regionName', { regionName: options.regionName });
    }

    if (options?.activeOnly !== false) {
      query.andWhere('center.isActive = :isActive', { isActive: true });
    }

    return query.orderBy('center.name', 'ASC').getMany();
  }

  async getCenter(id: string): Promise<InspectionCenterEntity> {
    const center = await this.centerRepo.findOne({
      where: { id },
      relations: ['assignments', 'assignments.inspectorProfile', 'assignments.inspectorProfile.user'],
    });

    if (!center) {
      throw new NotFoundException(`Inspection Center with ID "${id}" not found.`);
    }

    return center;
  }

  async updateCenter(id: string, dto: UpdateInspectionCenterDto): Promise<InspectionCenterEntity> {
    const center = await this.getCenter(id);

    if (dto.code && dto.code !== center.code) {
      const existing = await this.centerRepo.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException(`Inspection Center with code "${dto.code}" already exists.`);
      }
    }

    Object.assign(center, dto);
    return this.centerRepo.save(center);
  }

  async deactivateCenter(id: string): Promise<void> {
    const center = await this.getCenter(id);
    center.isActive = false;
    await this.centerRepo.save(center);
  }

  async assignInspector(centerId: string, inspectorProfileId: string): Promise<InspectorCenterAssignmentEntity> {
    const center = await this.getCenter(centerId);
    if (!center.isActive) {
      throw new BadRequestException('Cannot assign inspector to an inactive Inspection Center.');
    }

    const inspector = await this.inspectorProfileRepo.findOne({ where: { id: inspectorProfileId } });
    if (!inspector) {
      throw new NotFoundException(`Inspector profile with ID "${inspectorProfileId}" not found.`);
    }

    // Set previous assignment as non-current
    await this.assignmentRepo.update(
      { inspectorProfileId, isCurrentAssignment: true },
      { isCurrentAssignment: false },
    );

    const assignment = this.assignmentRepo.create({
      inspectionCenterId: centerId,
      inspectorProfileId,
      isCurrentAssignment: true,
    });

    return this.assignmentRepo.save(assignment);
  }

  async listInspectorsForCenter(centerId: string): Promise<InspectorProfileEntity[]> {
    await this.getCenter(centerId); // validates center exists

    const assignments = await this.assignmentRepo.find({
      where: { inspectionCenterId: centerId, isCurrentAssignment: true },
      relations: ['inspectorProfile', 'inspectorProfile.user'],
    });

    return assignments.map((a) => a.inspectorProfile);
  }

  async getAssignedCenter(userId: string): Promise<InspectionCenterEntity | null> {
    const inspector = await this.inspectorProfileRepo.findOne({ where: { userId } });
    if (!inspector) {
      throw new NotFoundException('Inspector profile not found for current user.');
    }

    const currentAssignment = await this.assignmentRepo.findOne({
      where: { inspectorProfileId: inspector.id, isCurrentAssignment: true },
      relations: ['center'],
    });

    return currentAssignment ? currentAssignment.center : null;
  }
}
