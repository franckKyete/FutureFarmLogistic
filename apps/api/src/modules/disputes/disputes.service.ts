import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DisputeEntity } from './entities/dispute.entity';
import { CreateDisputeDtoClass } from './dto/create-dispute.dto';
import { UpdateDisputeDtoClass } from './dto/update-dispute.dto';
import { ResolveDisputeDtoClass } from './dto/resolve-dispute.dto';
import { DisputeStatus } from '@futurefarm/types';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputesRepository: Repository<DisputeEntity>,
  ) {}

  async findAll(): Promise<DisputeEntity[]> {
    return this.disputesRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['createdBy', 'assignedTo'],
    });
  }

  async findOne(id: string): Promise<DisputeEntity> {
    const dispute = await this.disputesRepository.findOne({
      where: { id },
      relations: ['createdBy', 'assignedTo'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }
    return dispute;
  }

  async create(dto: CreateDisputeDtoClass): Promise<DisputeEntity> {
    const dispute = this.disputesRepository.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      relatedType: dto.relatedType,
      relatedId: dto.relatedId,
    });
    return this.disputesRepository.save(dispute);
  }

  async update(id: string, dto: UpdateDisputeDtoClass): Promise<DisputeEntity> {
    const dispute = await this.findOne(id);
    Object.assign(dispute, dto);
    return this.disputesRepository.save(dispute);
  }

  async resolve(id: string, dto: ResolveDisputeDtoClass): Promise<DisputeEntity> {
    const dispute = await this.findOne(id);
    dispute.resolutionNotes = dto.resolutionNotes;
    dispute.status = dto.status ?? DisputeStatus.RESOLVED;
    return this.disputesRepository.save(dispute);
  }

  async remove(id: string): Promise<void> {
    const dispute = await this.findOne(id);
    await this.disputesRepository.remove(dispute);
  }
}
