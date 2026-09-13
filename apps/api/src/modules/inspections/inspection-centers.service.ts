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
      regionName: dto.regionName.trim(),
      address: dto.address,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    const savedCenter = await this.centerRepo.save(center);

    if (dto.inspectorProfileIds && dto.inspectorProfileIds.length > 0) {
      for (const inspectorProfileId of dto.inspectorProfileIds) {
        const inspector = await this.inspectorProfileRepo.findOne({ where: { id: inspectorProfileId } });
        if (inspector) {
          const assignment = this.assignmentRepo.create({
            inspectionCenterId: savedCenter.id,
            inspectorProfileId,
            isCurrentAssignment: true,
          });
          await this.assignmentRepo.save(assignment);
        }
      }
    }

    return this.getCenter(savedCenter.id);
  }

  async getActiveRegions(): Promise<string[]> {
    const centers = await this.centerRepo.find({
      where: { isActive: true },
      select: ['regionName'],
      order: { regionName: 'ASC' },
    });

    const unique = Array.from(
      new Set(centers.map((c) => c.regionName?.trim()).filter(Boolean)),
    ) as string[];
    return unique.sort((a, b) => a.localeCompare(b));
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
    await this.centerRepo.save(center);

    if (dto.inspectorProfileIds !== undefined) {
      const currentAssignments = await this.assignmentRepo.find({
        where: { inspectionCenterId: id, isCurrentAssignment: true },
      });

      const currentIds = currentAssignments.map((a) => a.inspectorProfileId);
      const targetIds = dto.inspectorProfileIds;

      // Deactivate removed assignments
      for (const assignment of currentAssignments) {
        if (!targetIds.includes(assignment.inspectorProfileId)) {
          // Check if inspector has other active centers
          const totalActive = await this.assignmentRepo.count({
            where: {
              inspectorProfileId: assignment.inspectorProfileId,
              isCurrentAssignment: true,
            },
          });
          if (totalActive <= 1) {
            throw new BadRequestException(
              `Impossible de retirer un inspecteur qui n'a que ce centre assigné.`,
            );
          }
          assignment.isCurrentAssignment = false;
          await this.assignmentRepo.save(assignment);
        }
      }

      // Add new assignments
      for (const inspId of targetIds) {
        if (!currentIds.includes(inspId)) {
          const existingAssignment = await this.assignmentRepo.findOne({
            where: { inspectionCenterId: id, inspectorProfileId: inspId },
          });
          if (existingAssignment) {
            existingAssignment.isCurrentAssignment = true;
            await this.assignmentRepo.save(existingAssignment);
          } else {
            const newAssignment = this.assignmentRepo.create({
              inspectionCenterId: id,
              inspectorProfileId: inspId,
              isCurrentAssignment: true,
            });
            await this.assignmentRepo.save(newAssignment);
          }
        }
      }
    }

    return this.getCenter(id);
  }

  async deactivateCenter(id: string): Promise<void> {
    const center = await this.getCenter(id);

    // Verify whether any inspector is only assigned to this center
    const activeAssignments = await this.assignmentRepo.find({
      where: { inspectionCenterId: id, isCurrentAssignment: true },
    });

    for (const assignment of activeAssignments) {
      const inspectorAssignments = await this.assignmentRepo.count({
        where: {
          inspectorProfileId: assignment.inspectorProfileId,
          isCurrentAssignment: true,
        },
      });
      if (inspectorAssignments <= 1) {
        throw new BadRequestException(
          `Impossible de désactiver ce centre car il s'agit du seul centre assigné pour un ou plusieurs inspecteurs.`,
        );
      }
    }

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

    const existing = await this.assignmentRepo.findOne({
      where: { inspectionCenterId: centerId, inspectorProfileId },
    });

    if (existing) {
      existing.isCurrentAssignment = true;
      return this.assignmentRepo.save(existing);
    }

    const assignment = this.assignmentRepo.create({
      inspectionCenterId: centerId,
      inspectorProfileId,
      isCurrentAssignment: true,
    });

    return this.assignmentRepo.save(assignment);
  }

  async unassignInspector(centerId: string, inspectorProfileId: string): Promise<void> {
    const activeAssignments = await this.assignmentRepo.find({
      where: { inspectorProfileId, isCurrentAssignment: true },
    });

    if (activeAssignments.length <= 1) {
      throw new BadRequestException(
        "Impossible de retirer ce centre : un inspecteur doit conserver au moins un centre d'inspection actif pour rester valide.",
      );
    }

    const assignment = activeAssignments.find((a) => a.inspectionCenterId === centerId);
    if (assignment) {
      assignment.isCurrentAssignment = false;
      await this.assignmentRepo.save(assignment);
    }
  }

  async listInspectorsForCenter(centerId: string): Promise<InspectorProfileEntity[]> {
    await this.getCenter(centerId); // validates center exists

    const assignments = await this.assignmentRepo.find({
      where: { inspectionCenterId: centerId, isCurrentAssignment: true },
      relations: ['inspectorProfile', 'inspectorProfile.user'],
    });

    return assignments.map((a) => a.inspectorProfile);
  }

  async getAssignedCenters(userId: string): Promise<InspectionCenterEntity[]> {
    const inspector = await this.inspectorProfileRepo.findOne({ where: { userId } });
    if (!inspector) {
      throw new NotFoundException('Inspector profile not found for current user.');
    }

    const assignments = await this.assignmentRepo.find({
      where: { inspectorProfileId: inspector.id, isCurrentAssignment: true },
      relations: ['center'],
    });

    return assignments
      .map((a) => a.center)
      .filter((c): c is InspectionCenterEntity => !!c && c.isActive);
  }

  async getAssignedCenter(userId: string): Promise<InspectionCenterEntity | null> {
    const centers = await this.getAssignedCenters(userId);
    return centers[0] ?? null;
  }
}
