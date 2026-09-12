import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import type { PaginatedResult, PaginationQuery, AuthUser } from '@futurefarm/types';
import { UserStatus, ParcelStatus, NotificationChannel, NotificationPriority } from '@futurefarm/types';

import { UserEntity } from './entities/user.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { FarmerProfileEntity } from './entities/farmer-profile.entity';
import { BuyerProfileEntity } from './entities/buyer-profile.entity';
import { ParcelEntity } from './entities/parcel.entity';

import { RegisterFarmerDto } from './dto/register-farmer.dto';
import { RegisterFarmerProxyDto } from './dto/register-farmer-proxy.dto';
import { RegisterBuyerDto } from './dto/register-buyer.dto';
import { RegisterInspectorDto } from './dto/register-inspector.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';
import {
  UpdateFarmerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/profile.dto';
import { CreateParcelDto } from './dto/parcel.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { InspectionCenterEntity } from '../inspections/entities/inspection-center.entity';
import { InspectorCenterAssignmentEntity } from '../inspections/entities/inspector-center-assignment.entity';
import { DriverProfileEntity } from '../logistics/entities/driver-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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
    @InjectRepository(InspectorProfileEntity)
    private readonly inspectorProfileRepository: Repository<InspectorProfileEntity>,
    @InjectRepository(InspectionCenterEntity)
    private readonly centerRepository: Repository<InspectionCenterEntity>,
    @InjectRepository(InspectorCenterAssignmentEntity)
    private readonly assignmentRepository: Repository<InspectorCenterAssignmentEntity>,
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfileRepository: Repository<DriverProfileEntity>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    query: PaginationQuery & { role?: string; status?: string; search?: string; regionName?: string },
    caller?: AuthUser,
  ): Promise<PaginatedResult<any>> {
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
      qb.andWhere('LOWER(role.name) = LOWER(:role)', { role: query.role });
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

    // Determine regional scoping:
    // If caller is an Inspector (and not an Admin):
    const isInspector = caller?.roles?.includes('Inspector') && !caller?.roles?.includes('Admin');
    if (isInspector && caller?.id) {
      const inspectorProfile = await this.inspectorProfileRepository.findOne({
        where: { userId: caller.id },
        relations: ['assignments', 'assignments.center'],
      });
      const activeAssignments = inspectorProfile?.assignments?.filter(
        (a) => a.isCurrentAssignment && a.center?.isActive,
      ) || [];
      const assignedRegions = Array.from(
        new Set(activeAssignments.map((a) => a.center.regionName).filter(Boolean)),
      );

      // If inspector has no assigned regions/centers, they cannot see any regional farmers
      if (assignedRegions.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      qb.leftJoin(FarmerProfileEntity, 'farmerProfile', 'farmerProfile.userId = user.id');
      const assignedRegionsLower = assignedRegions.map((r) => r.toLowerCase());

      if (query.regionName) {
        if (!assignedRegionsLower.includes(query.regionName.toLowerCase())) {
          // Requested region is outside inspector's assignments
          return {
            data: [],
            meta: {
              total: 0,
              page,
              limit,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
        qb.andWhere('LOWER(farmerProfile.regionName) = LOWER(:reg)', { reg: query.regionName });
      } else {
        qb.andWhere('LOWER(farmerProfile.regionName) IN (:...assignedRegionsLower)', {
          assignedRegionsLower,
        });
      }
    } else if (query.regionName) {
      // Admin filtering by region
      qb.leftJoin(FarmerProfileEntity, 'farmerProfile', 'farmerProfile.userId = user.id');
      qb.andWhere('LOWER(farmerProfile.regionName) = LOWER(:reg)', { reg: query.regionName });
    }

    const [users, total] = await qb.getManyAndCount();

    // Hydrate farmer profile information for farmer role queries or users with farmer profiles
    const userIds = users.map((u) => u.id);
    let farmerProfilesMap = new Map<string, FarmerProfileEntity>();
    if (userIds.length > 0) {
      const farmerProfiles = await this.farmerProfileRepository.find({
        where: { userId: In(userIds) },
      });
      farmerProfilesMap = new Map(farmerProfiles.map((fp) => [fp.userId, fp]));
    }

    const data = users.map((u) => {
      const fp = farmerProfilesMap.get(u.id);
      return {
        ...u,
        phone: u.phoneNumber,
        farmName: fp?.companyName,
        regionName: fp?.regionName,
        profile: fp
          ? {
              companyName: fp.companyName,
              address: fp.address,
              regionName: fp.regionName,
              isCertified: fp.isCertified,
            }
          : undefined,
      };
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

  async findOne(id: string): Promise<UserEntity & { profile?: any }> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const roleNames = user.roles?.map((r) => r.name) ?? [];
    let profile: any = null;
    if (roleNames.includes('Inspector')) {
      const insp = await this.inspectorProfileRepository.findOne({
        where: { userId: id },
        relations: ['assignments', 'assignments.center'],
      });
      if (insp) {
        const assignedCenters = insp.assignments
          ?.filter((a) => a.isCurrentAssignment && a.center?.isActive)
          ?.map((a) => ({
            id: a.center.id,
            name: a.center.name,
            code: a.center.code,
            regionName: a.center.regionName,
            address: a.center.address,
          })) || [];
        profile = {
          ...insp,
          assignedCenters,
        };
      }
    } else if (roleNames.includes('Driver')) {
      profile = await this.driverProfileRepository.findOneBy({ userId: id });
    } else if (roleNames.includes('Farmer')) {
      profile = await this.farmerProfileRepository.findOne({
        where: { userId: id },
        relations: ['parcels'],
      });
    } else if (roleNames.includes('Buyer')) {
      profile = await this.buyerProfileRepository.findOneBy({ userId: id });
    }

    return {
      ...user,
      profile,
    } as any;
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
      status: UserStatus.APPROVED,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.farmerProfileRepository.create({
      userId: savedUser.id,
      companyName: dto.companyName,
      address: dto.address,
      regionName: dto.regionName.trim(),
      bio: dto.bio ?? null,
    });

    await this.farmerProfileRepository.save(profile);

    // Send welcome email notification
    try {
      await this.notificationsService.send({
        recipientIds: [savedUser.id],
        title: 'Bienvenue sur Future Farm !',
        body: `Bonjour ${savedUser.firstName},\n\nVotre compte Producteur Agricole a été créé avec succès. Vous pouvez dès à présent vous connecter, enregistrer vos parcelles et proposer vos récoltes.`,
        channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
        priority: NotificationPriority.NORMAL,
        metadata: {
          actionUrl: '/auth/login',
          actionText: 'Accéder à mon espace',
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send welcome email to farmer ${savedUser.email}:`,
        err,
      );
    }

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
      status: UserStatus.APPROVED,
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

    // Send welcome email notification
    try {
      await this.notificationsService.send({
        recipientIds: [savedUser.id],
        title: 'Bienvenue sur Future Farm !',
        body: `Bonjour ${savedUser.firstName},\n\nVotre compte Acheteur Professionnel a été créé avec succès. Vous pouvez dès à présent explorer le catalogue et commander des récoltes certifiées.`,
        channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
        priority: NotificationPriority.NORMAL,
        metadata: {
          actionUrl: '/auth/login',
          actionText: 'Accéder au catalogue',
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send welcome email to buyer ${savedUser.email}:`,
        err,
      );
    }

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
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (user) {
      if (dto.firstName !== undefined) user.firstName = dto.firstName;
      if (dto.lastName !== undefined) user.lastName = dto.lastName;
      if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber || null;
      await this.usersRepository.save(user);
    }

    const profile = await this.getFarmerProfile(userId);
    profile.companyName = dto.companyName;
    profile.address = dto.address;
    if (dto.regionName !== undefined) {
      profile.regionName = dto.regionName ? dto.regionName.trim() : null;
    }
    profile.bio = dto.bio ?? null;
    if (dto.avatarUrl !== undefined) {
      profile.avatarUrl = dto.avatarUrl || null;
    }
    if (dto.isCertified !== undefined) {
      profile.isCertified = dto.isCertified;
    }
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
      status: UserStatus.APPROVED,
      isActive: true,
      createdByActorId: actorId,
    });

    const savedUser = await this.usersRepository.save(user);

    const companyName = dto.companyName || dto.farmName || 'Exploitation Agricole';
    const address = dto.address || '';
    let regionName = dto.regionName ? dto.regionName.trim() : null;

    // If actor is an inspector, validate or auto-assign regionName
    const inspectorProfile = await this.inspectorProfileRepository.findOne({
      where: { userId: actorId },
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
          "Vous devez être affecté à au moins un centre d'inspection actif pour enrôler un producteur.",
        );
      }
      if (regionName) {
        const matchingRegion = assignedRegions.find(
          (r) => r.toLowerCase() === regionName!.toLowerCase(),
        );
        if (!matchingRegion) {
          throw new ForbiddenException(
            `Vous ne pouvez enrôler des producteurs que dans vos régions assignées (${assignedRegions.join(', ')}).`,
          );
        }
        regionName = matchingRegion;
      } else {
        regionName = assignedRegions[0]!;
      }
    }

    const profile = this.farmerProfileRepository.create({
      userId: savedUser.id,
      companyName,
      address,
      regionName,
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
    if (!user.isActive) {
      throw new BadRequestException(
        'Impossible de modifier le statut d’un utilisateur inactif. Le compte s’active automatiquement lors de sa première connexion.',
      );
    }
    user.status = status;
    return this.usersRepository.save(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserEntity & { profile?: any }> {
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
    await this.usersRepository.save(user);

    // Update associated profile if present
    const roleNames = user.roles?.map((r) => r.name) ?? [];
    if (roleNames.includes('Inspector')) {
      const inspProfile = await this.inspectorProfileRepository.findOneBy({ userId: id });
      if (inspProfile) {
        if (dto.licenseNumber !== undefined) inspProfile.licenseNumber = dto.licenseNumber;
        if (dto.agencyName !== undefined) inspProfile.agencyName = dto.agencyName;
        if (dto.specializations !== undefined) inspProfile.specializations = dto.specializations;
        await this.inspectorProfileRepository.save(inspProfile);

        if (dto.inspectionCenterIds !== undefined) {
          if (dto.inspectionCenterIds.length === 0) {
            throw new BadRequestException(
              'Un inspecteur doit obligatoirement conserver au moins un centre d’inspection assigné',
            );
          }

          const targetIds = Array.from(new Set(dto.inspectionCenterIds));
          for (const cid of targetIds) {
            const center = await this.centerRepository.findOneBy({ id: cid });
            if (!center || !center.isActive) {
              throw new BadRequestException(`Centre d'inspection introuvable ou inactif : ${cid}`);
            }
          }

          const currentAssignments = await this.assignmentRepository.find({
            where: { inspectorProfileId: inspProfile.id, isCurrentAssignment: true },
          });

          // Deactivate assignments no longer in targetIds
          for (const assignment of currentAssignments) {
            if (!targetIds.includes(assignment.inspectionCenterId)) {
              assignment.isCurrentAssignment = false;
              await this.assignmentRepository.save(assignment);
            }
          }

          // Activate or create assignments for targetIds
          for (const cid of targetIds) {
            const existing = await this.assignmentRepository.findOne({
              where: { inspectorProfileId: inspProfile.id, inspectionCenterId: cid },
            });
            if (existing) {
              if (!existing.isCurrentAssignment) {
                existing.isCurrentAssignment = true;
                await this.assignmentRepository.save(existing);
              }
            } else {
              const newAssignment = this.assignmentRepository.create({
                inspectorProfileId: inspProfile.id,
                inspectionCenterId: cid,
                isCurrentAssignment: true,
              });
              await this.assignmentRepository.save(newAssignment);
            }
          }
        }
      }
    } else if (roleNames.includes('Driver')) {
      const driverProfile = await this.driverProfileRepository.findOneBy({ userId: id });
      if (driverProfile) {
        if (dto.licenseNumber !== undefined) driverProfile.licenseNumber = dto.licenseNumber;
        if (dto.licenseCategory !== undefined) driverProfile.licenseCategory = dto.licenseCategory;
        if (dto.isAvailable !== undefined) driverProfile.isAvailable = dto.isAvailable;
        await this.driverProfileRepository.save(driverProfile);
      }
    } else if (roleNames.includes('Farmer')) {
      const farmerProfile = await this.farmerProfileRepository.findOneBy({ userId: id });
      if (farmerProfile) {
        if (dto.companyName !== undefined) farmerProfile.companyName = dto.companyName;
        if (dto.address !== undefined) farmerProfile.address = dto.address;
        if (dto.regionName !== undefined) farmerProfile.regionName = dto.regionName ? dto.regionName.trim() : null;
        if (dto.bio !== undefined) farmerProfile.bio = dto.bio;
        if (dto.isCertified !== undefined) farmerProfile.isCertified = dto.isCertified;
        if (dto.avatarUrl !== undefined) farmerProfile.avatarUrl = dto.avatarUrl;
        await this.farmerProfileRepository.save(farmerProfile);
      }
    } else if (roleNames.includes('Buyer')) {
      const buyerProfile = await this.buyerProfileRepository.findOneBy({ userId: id });
      if (buyerProfile) {
        if (dto.companyName !== undefined) buyerProfile.companyName = dto.companyName;
        if (dto.vatNumber !== undefined) buyerProfile.vatNumber = dto.vatNumber;
        if (dto.billingAddress !== undefined) buyerProfile.billingAddress = dto.billingAddress;
        if (dto.shippingAddress !== undefined) buyerProfile.shippingAddress = dto.shippingAddress;
        await this.buyerProfileRepository.save(buyerProfile);
      }
    }

    return this.findOne(id);
  }

  async softDeleteUser(id: string): Promise<UserEntity> {
    const user = await this.findOne(id);
    user.status = UserStatus.SUSPENDED;
    return this.usersRepository.save(user);
  }

  async registerInspector(dto: RegisterInspectorDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (!dto.inspectionCenterIds || dto.inspectionCenterIds.length === 0) {
      throw new BadRequestException(
        'Au moins un centre d’inspection doit être assigné à l’inspecteur',
      );
    }

    const uniqueCenterIds = Array.from(new Set(dto.inspectionCenterIds));
    for (const centerId of uniqueCenterIds) {
      const center = await this.centerRepository.findOneBy({ id: centerId });
      if (!center || !center.isActive) {
        throw new BadRequestException(`Centre d'inspection introuvable ou inactif : ${centerId}`);
      }
    }

    const inspectorRole = await this.rolesRepository.findOneBy({ name: 'Inspector' });
    if (!inspectorRole) {
      throw new InternalServerErrorException(
        'Inspector role not configured in system',
      );
    }

    const tempPassword =
      dto.password ||
      Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-4) +
        '!';

    const user = this.usersRepository.create({
      email: dto.email,
      password: tempPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      roles: [inspectorRole],
      status: UserStatus.APPROVED,
      isActive: false, // Inactive until first login
      mustChangePassword: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.inspectorProfileRepository.create({
      userId: savedUser.id,
      licenseNumber:
        dto.licenseNumber ||
        `INSP-${Math.random().toString(36).slice(-6).toUpperCase()}`,
      agencyName: dto.agencyName || 'Future Farm Inspection',
      specializations: dto.specializations || ['Céréales & Grains', 'Fruits & Légumes'],
      isActiveInspector: true,
    });

    const savedProfile = await this.inspectorProfileRepository.save(profile);

    // Create center assignments
    for (const centerId of uniqueCenterIds) {
      const assignment = this.assignmentRepository.create({
        inspectionCenterId: centerId,
        inspectorProfileId: savedProfile.id,
        isCurrentAssignment: true,
      });
      await this.assignmentRepository.save(assignment);
    }

    // Send email notification with login credentials (non-blocking)
    try {
      await this.notificationsService.send({
        recipientIds: [savedUser.id],
        title: 'Bienvenue sur Future Farm - Vos identifiants d’accès',
        body: `Bonjour ${savedUser.firstName},\n\nVotre compte Inspecteur Qualité a été créé avec succès sur la plateforme Future Farm.\n\nVoici vos identifiants de connexion :\n- Email : ${savedUser.email}\n- Mot de passe temporaire : ${tempPassword}\n\nPour des raisons de sécurité, nous vous invitons à changer votre mot de passe dès votre première connexion.`,
        channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
        priority: NotificationPriority.HIGH,
        metadata: {
          actionUrl: '/auth/login',
          actionText: 'Se connecter',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue welcome email to inspector ${savedUser.email}:`,
        error,
      );
    }

    return savedUser;
  }

  async registerDriver(dto: RegisterDriverDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const driverRole = await this.rolesRepository.findOneBy({ name: 'Driver' });
    if (!driverRole) {
      throw new InternalServerErrorException(
        'Driver role not configured in system',
      );
    }

    const tempPassword =
      dto.password ||
      Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-4) +
        '!';

    const user = this.usersRepository.create({
      email: dto.email,
      password: tempPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      roles: [driverRole],
      status: UserStatus.APPROVED,
      isActive: false, // Inactive until first login
      mustChangePassword: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.driverProfileRepository.create({
      userId: savedUser.id,
      licenseNumber: dto.licenseNumber,
      licenseCategory: dto.licenseCategory,
      licenseExpiresAt: dto.licenseExpiresAt ?? null,
      isAvailable: true,
      averageRating: 5.0,
      totalDeliveriesCompleted: 0,
    });

    await this.driverProfileRepository.save(profile);

    // Send email notification with login credentials (non-blocking)
    try {
      await this.notificationsService.send({
        recipientIds: [savedUser.id],
        title: 'Bienvenue sur Future Farm - Vos identifiants d’accès',
        body: `Bonjour ${savedUser.firstName},\n\nVotre compte Chauffeur / Transporteur a été créé avec succès sur la plateforme Future Farm.\n\nVoici vos identifiants de connexion :\n- Email : ${savedUser.email}\n- Mot de passe temporaire : ${tempPassword}\n\nPour des raisons de sécurité, nous vous invitons à changer votre mot de passe dès votre première connexion.`,
        channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
        priority: NotificationPriority.HIGH,
        metadata: {
          actionUrl: '/auth/login',
          actionText: 'Se connecter',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue welcome email to driver ${savedUser.email}:`,
        error,
      );
    }

    return savedUser;
  }

  async resendWelcomeNotification(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isActive) {
      throw new BadRequestException("Impossible de renvoyer les accès d'un utilisateur déjà actif.");
    }

    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-4) +
      '!';
    user.password = tempPassword;
    user.mustChangePassword = true;
    await this.usersRepository.save(user);

    const body = `Bonjour ${user.firstName},\n\nVoici vos nouveaux identifiants d’accès à la plateforme Future Farm :\n- Email : ${user.email}\n- Nouveau mot de passe temporaire : ${tempPassword}\n\nVotre compte sera activé dès votre première connexion.`;

    try {
      await this.notificationsService.send({
        recipientIds: [user.id],
        title: 'Vos identifiants d’accès - Future Farm',
        body,
        channels: [NotificationChannel.EMAIL, NotificationChannel.DATABASE],
        priority: NotificationPriority.HIGH,
        metadata: {
          actionUrl: '/auth/login',
          actionText: 'Se connecter',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to resend welcome notification to ${user.email}:`,
        error,
      );
      throw new BadRequestException(
        "Échec de l'envoi de l'email d'activation. Veuillez réessayer ultérieurement.",
      );
    }

    return {
      success: true,
      message: "Email d'activation renvoyé avec succès.",
    };
  }
}
