import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PaginatedResult, PaginationQuery } from '@futurefarm/types';

import { ExampleEntity } from './entities/example.entity';
import type { CreateExampleDto, UpdateExampleDto } from './dto/example.dto';

@Injectable()
export class ExampleService {
  constructor(
    @InjectRepository(ExampleEntity)
    private readonly exampleRepository: Repository<ExampleEntity>,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResult<ExampleEntity>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.exampleRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<ExampleEntity> {
    const entity = await this.exampleRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Example with id ${id} not found`);
    }
    return entity;
  }

  async create(dto: CreateExampleDto): Promise<ExampleEntity> {
    const entity = this.exampleRepository.create(dto);
    return this.exampleRepository.save(entity);
  }

  async update(id: string, dto: UpdateExampleDto): Promise<ExampleEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.exampleRepository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.exampleRepository.remove(entity);
  }
}
