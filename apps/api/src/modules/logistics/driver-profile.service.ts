import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverProfileEntity } from './entities/driver-profile.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CreateDriverProfileDto, UpdateDriverProfileDto } from './dto/driver-profile.dto';

@Injectable()
export class DriverProfileService {
  constructor(
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfileRepo: Repository<DriverProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createProfile(dto: CreateDriverProfileDto): Promise<DriverProfileEntity> {
    const user = await this.userRepo.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const existing = await this.driverProfileRepo.findOneBy({ userId: dto.userId });
    if (existing) {
      throw new ConflictException(`Driver profile already exists for user ${dto.userId}`);
    }

    const profile = this.driverProfileRepo.create({
      userId: dto.userId,
      licenseNumber: dto.licenseNumber,
      licenseCategory: dto.licenseCategory,
      licenseExpiresAt: dto.licenseExpiresAt || null,
      isAvailable: true,
    });

    return this.driverProfileRepo.save(profile);
  }

  async getProfileByUserId(userId: string): Promise<DriverProfileEntity> {
    const profile = await this.driverProfileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException(`Driver profile not found for user ${userId}`);
    }
    return profile;
  }

  async updateProfileByUserId(
    userId: string,
    dto: UpdateDriverProfileDto,
  ): Promise<DriverProfileEntity> {
    const profile = await this.getProfileByUserId(userId);

    if (dto.licenseNumber !== undefined) profile.licenseNumber = dto.licenseNumber;
    if (dto.licenseCategory !== undefined) profile.licenseCategory = dto.licenseCategory;
    if (dto.licenseExpiresAt !== undefined) profile.licenseExpiresAt = dto.licenseExpiresAt || null;
    if (dto.isAvailable !== undefined) profile.isAvailable = dto.isAvailable;

    return this.driverProfileRepo.save(profile);
  }

  async deleteProfileByUserId(userId: string): Promise<void> {
    const profile = await this.getProfileByUserId(userId);
    await this.driverProfileRepo.remove(profile);
  }

  async listProfiles(page = 1, limit = 20): Promise<{ data: DriverProfileEntity[]; total: number }> {
    const [data, total] = await this.driverProfileRepo.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }
}
