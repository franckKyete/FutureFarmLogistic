import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { Permission } from '@futurefarm/types';

import { RoleEntity } from './entities/role.entity';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findAll(): Promise<RoleEntity[]> {
    return this.rolesRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<RoleEntity> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return role;
  }

  async create(
    name: string,
    permissions: Permission[],
    description?: string,
  ): Promise<RoleEntity> {
    const existing = await this.rolesRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Role '${name}' already exists`);
    }
    const role = this.rolesRepository.create({
      name,
      permissions,
      description: description ?? null,
    });
    return this.rolesRepository.save(role);
  }

  async updatePermissions(
    id: string,
    permissions: Permission[],
  ): Promise<RoleEntity> {
    const role = await this.findOne(id);
    role.permissions = permissions;
    return this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    await this.rolesRepository.remove(role);
  }

  async assignRolesToUser(userId: string, roleIds: string[]): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const roles = await this.rolesRepository.findBy({
      id: In(roleIds),
    });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException('One or more roles not found');
    }

    user.roles = roles;
    return this.usersRepository.save(user);
  }
}
