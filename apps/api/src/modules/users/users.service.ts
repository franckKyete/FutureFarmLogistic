import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PaginatedResult, PaginationQuery } from '@futurefarm/types';
import { UserStatus, ParcelStatus } from '@futurefarm/types';

import { UserEntity } from './entities/user.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { FarmerProfileEntity } from './entities/farmer-profile.entity';
import { BuyerProfileEntity } from './entities/buyer-profile.entity';
import { ParcelEntity } from './entities/parcel.entity';

import { RegisterFarmerDto } from './dto/register-farmer.dto';
import { RegisterFarmerProxyDto } from './dto/register-farmer-proxy.dto';
import { RegisterBuyerDto } from './dto/register-buyer.dto';
import {
  UpdateFarmerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/profile.dto';
import { CreateParcelDto } from './dto/parcel.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepository: Repository<FarmerProfileEntity>,
    @InjectRepository(BuyerProfileEntity)
    private readonly buyerProfileRepository: Repository<BuyerProfileEntity>,
    @InjectRepository(ParcelEntity)
    private readonly parcelRepository: Repository<ParcelEntity>,
  ) {}

  async findAll(
    query: PaginationQuery & { role?: string; status?: string; search?: string },
  ): Promise<PaginatedResult<Omit<UserEntity, 'password'>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (query.role) {
      qb.andWhere('role.name = :role', { role: query.role });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

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

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async registerFarmer(dto: RegisterFarmerDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const farmerRole = await this.rolesRepository.findOneBy({ name: 'Farmer' });
    if (!farmerRole) {
      throw new InternalServerErrorException(
        'Farmer role not configured in system',
      );
    }

    const user = this.usersRepository.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber ?? null,
      roles: [farmerRole],
      status: UserStatus.PENDING_VALIDATION,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.farmerProfileRepository.create({
      userId: savedUser.id,
      companyName: dto.companyName,
      address: dto.address,
      bio: dto.bio ?? null,
    });

    await this.farmerProfileRepository.save(profile);

    return savedUser;
  }

  async registerBuyer(dto: RegisterBuyerDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const buyerRole = await this.rolesRepository.findOneBy({ name: 'Buyer' });
    if (!buyerRole) {
      throw new InternalServerErrorException(
        'Buyer role not configured in system',
      );
    }

    const user = this.usersRepository.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber ?? null,
      roles: [buyerRole],
      status: UserStatus.PENDING_VALIDATION,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.buyerProfileRepository.create({
      userId: savedUser.id,
      companyName: dto.companyName,
      vatNumber: dto.vatNumber,
      businessType: dto.businessType,
      billingAddress: dto.billingAddress,
      shippingAddress: dto.shippingAddress,
    });

    await this.buyerProfileRepository.save(profile);

    return savedUser;
  }

  async getFarmerProfile(userId: string): Promise<FarmerProfileEntity> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { userId },
      relations: ['parcels'],
    });
    if (!profile) {
      throw new NotFoundException('Farmer profile not found');
    }
    return profile;
  }

  async getBuyerProfile(userId: string): Promise<BuyerProfileEntity> {
    const profile = await this.buyerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Buyer profile not found');
    }
    return profile;
  }

  async updateFarmerProfile(
    userId: string,
    dto: UpdateFarmerProfileDto,
  ): Promise<FarmerProfileEntity> {
    const profile = await this.getFarmerProfile(userId);
    profile.companyName = dto.companyName;
    profile.address = dto.address;
    profile.bio = dto.bio ?? null;
    return this.farmerProfileRepository.save(profile);
  }

  async updateBuyerProfile(
    userId: string,
    dto: UpdateBuyerProfileDto,
  ): Promise<BuyerProfileEntity> {
    const profile = await this.getBuyerProfile(userId);
    profile.companyName = dto.companyName;
    profile.vatNumber = dto.vatNumber;
    profile.businessType = dto.businessType;
    profile.billingAddress = dto.billingAddress;
    profile.shippingAddress = dto.shippingAddress;
    return this.buyerProfileRepository.save(profile);
  }

  async createParcel(
    userId: string,
    dto: CreateParcelDto,
  ): Promise<ParcelEntity> {
    const profile = await this.farmerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new ForbiddenException(
        'Only users with a Farmer profile can submit parcels.',
      );
    }

    const parcel = this.parcelRepository.create({
      farmerProfileId: profile.id,
      cadastralNumber: dto.cadastralNumber,
      sizeHectares: dto.sizeHectares,
      locationCoordinates: dto.locationCoordinates,
      cropTypes: dto.cropTypes,
      status: ParcelStatus.PENDING,
    });

    return this.parcelRepository.save(parcel);
  }

  async getMyParcels(userId: string): Promise<ParcelEntity[]> {
    const profile = await this.farmerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new ForbiddenException(
        'Only users with a Farmer profile have land parcels.',
      );
    }
    return this.parcelRepository.findBy({ farmerProfileId: profile.id });
  }

  async verifyParcel(
    parcelId: string,
    inspectorId: string,
    status: ParcelStatus,
  ): Promise<ParcelEntity> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) {
      throw new NotFoundException(`Parcel with ID ${parcelId} not found`);
    }

    parcel.status = status;
    parcel.verifiedById = inspectorId;
    parcel.verifiedAt = new Date();

    return this.parcelRepository.save(parcel);
  }

  async registerFarmerProxy(actorId: string, dto: RegisterFarmerProxyDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const farmerRole = await this.rolesRepository.findOneBy({ name: 'Farmer' });
    if (!farmerRole) {
      throw new InternalServerErrorException(
        'Farmer role not configured in system',
      );
    }

    // Generate a temporary 12-character alphanumeric password for offline farmers
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let generatedPassword = '';
    for (let i = 0; i < 12; i++) {
      generatedPassword += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const user = this.usersRepository.create({
      email: dto.email,
      password: generatedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber ?? null,
      roles: [farmerRole],
      status: UserStatus.PENDING_VALIDATION,
      isActive: true,
      createdByActorId: actorId,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.farmerProfileRepository.create({
      userId: savedUser.id,
      companyName: dto.companyName,
      address: dto.address,
      bio: dto.bio ?? null,
    });

    await this.farmerProfileRepository.save(profile);

    // Attach temporary plain password dynamically to entity output (non-persisted) for inspector feedback
    (savedUser as any).temporaryPassword = generatedPassword;

    return savedUser;
  }

  async updateFarmerProfileProxy(
    targetFarmerId: string,
    dto: UpdateFarmerProfileDto,
  ): Promise<FarmerProfileEntity> {
    return this.updateFarmerProfile(targetFarmerId, dto);
  }

  async createParcelProxy(
    targetFarmerId: string,
    dto: CreateParcelDto,
  ): Promise<ParcelEntity> {
    return this.createParcel(targetFarmerId, dto);
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserEntity> {
    const user = await this.findOne(userId);
    user.status = status;
    return this.usersRepository.save(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.email !== undefined) {
      const existing = await this.usersRepository.findOneBy({ email: dto.email });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already registered');
      }
      user.email = dto.email;
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber || null;
    return this.usersRepository.save(user);
  }

  async softDeleteUser(id: string): Promise<UserEntity> {
    const user = await this.findOne(id);
    user.isActive = false;
    user.status = UserStatus.BANNED;
    return this.usersRepository.save(user);
  }
}
