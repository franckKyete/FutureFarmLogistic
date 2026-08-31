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
import { Repository } from 'typeorm';

import type { PaginatedResult, PaginationQuery } from '@futurefarm/types';
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
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfileRepository: Repository<DriverProfileEntity>,
    private readonly notificationsService: NotificationsService,
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
      profile = await this.inspectorProfileRepository.findOneBy({ userId: id });
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
    const profile = await this.getFarmerProfile(userId);
    profile.companyName = dto.companyName;
    profile.address = dto.address;
    profile.bio = dto.bio ?? null;
    if (dto.avatarUrl !== undefined) {
      profile.avatarUrl = dto.avatarUrl || null;
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

    await this.inspectorProfileRepository.save(profile);

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
