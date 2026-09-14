import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StorageService } from '../storage/storage.service';

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
import { VehicleEntity } from '../logistics/entities/vehicle.entity';
import { VehicleType } from '@futurefarm/types';
import { NotificationsService } from '../notifications/notifications.service';
import { AddressesService } from '../addresses/addresses.service';
import { AddressableType, AddressType } from '@futurefarm/types';
import { ConfigService } from '@nestjs/config';
import { StripePaymentGateway } from '../orders/adapters/stripe.adapter';

@Injectable()
export class UsersService implements OnModuleInit {
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
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly stripePaymentGateway: StripePaymentGateway,
    private readonly addressesService: AddressesService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly storageService?: StorageService,
  ) {}

  async onModuleInit() {
    await this.migrateLegacyAddresses();
  }

  private async migrateLegacyAddresses() {
    try {
      const farmerProfiles = await this.farmerProfileRepository.find();
      for (const fp of farmerProfiles) {
        if (fp.userId && fp.address) {
          const existingAddresses = await this.addressesService.listForUser(fp.userId);
          if (existingAddresses.length === 0) {
            await this.addressesService.upsertPrimaryAddress(
              AddressableType.USER,
              fp.userId,
              fp.address,
              AddressType.SHIPPING,
              { label: fp.companyName || 'Exploitation' },
            );
          }
        }
      }

      const buyerProfiles = await this.buyerProfileRepository.find();
      for (const bp of buyerProfiles) {
        if (bp.userId) {
          const existingAddresses = await this.addressesService.listForUser(bp.userId);
          if (existingAddresses.length === 0) {
            if (bp.shippingAddress) {
              await this.addressesService.upsertPrimaryAddress(
                AddressableType.USER,
                bp.userId,
                bp.shippingAddress,
                AddressType.SHIPPING,
                { label: 'Adresse de livraison' },
              );
            }
            if (bp.billingAddress && bp.billingAddress !== bp.shippingAddress) {
              await this.addressesService.upsertPrimaryAddress(
                AddressableType.USER,
                bp.userId,
                bp.billingAddress,
                AddressType.BILLING,
                { label: 'Adresse de facturation' },
              );
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[migrateLegacyAddresses] Non-fatal migration notice: ${err.message}`);
    }
  }

  async updateAvatar(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ avatarUrl: string }> {
    let avatarUrl = '';
    if (this.storageService) {
      const uploadResult = await this.storageService.uploadFile(buffer, filename, mimeType, 'avatars');
      avatarUrl = uploadResult.signedUrl || uploadResult.url;
    } else {
      avatarUrl = `https://ui-avatars.com/api/?name=User&background=004322&color=fff`;
    }

    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.avatarUrl = avatarUrl;
    await this.usersRepository.save(user);

    const farmerProfile = await this.farmerProfileRepository.findOneBy({ userId });
    if (farmerProfile) {
      farmerProfile.avatarUrl = avatarUrl;
      await this.farmerProfileRepository.save(farmerProfile);
    }

    return { avatarUrl };
  }

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
      const fp = await this.farmerProfileRepository.findOne({
        where: { userId: id },
        relations: ['parcels'],
      });
      if (fp) {
        const userAddresses = await this.addressesService.listForUser(id);
        const primaryAddress = userAddresses.find((a) => a.isDefault) || userAddresses[0];
        const formattedAddress = primaryAddress
          ? [
              primaryAddress.streetAddress,
              primaryAddress.streetAddress2,
              primaryAddress.city,
              primaryAddress.stateOrProvince,
              primaryAddress.country,
            ]
              .filter(Boolean)
              .join(', ')
          : fp.address;

        profile = {
          ...fp,
          address: formattedAddress,
          primaryAddress: primaryAddress || null,
          addressDetails: primaryAddress || null,
          addresses: userAddresses,
        };
      }
    } else if (roleNames.includes('Buyer')) {
      const bp = await this.buyerProfileRepository.findOneBy({ userId: id });
      if (bp) {
        const userAddresses = await this.addressesService.listForUser(id);
        const shippingAddress = userAddresses.find((a) => a.type === AddressType.SHIPPING && a.isDefault) ||
          userAddresses.find((a) => a.type === AddressType.SHIPPING) || userAddresses[0];
        const billingAddress = userAddresses.find((a) => a.type === AddressType.BILLING && a.isDefault) ||
          userAddresses.find((a) => a.type === AddressType.BILLING) || shippingAddress;

        const formatAddr = (addr?: typeof shippingAddress) =>
          addr
            ? [addr.streetAddress, addr.streetAddress2, addr.city, addr.stateOrProvince, addr.country]
                .filter(Boolean)
                .join(', ')
            : '';

        profile = {
          ...bp,
          shippingAddress: formatAddr(shippingAddress) || bp.shippingAddress,
          billingAddress: formatAddr(billingAddress) || bp.billingAddress,
          primaryShippingAddress: shippingAddress || null,
          primaryBillingAddress: billingAddress || null,
          shippingAddressDetails: shippingAddress || null,
          billingAddressDetails: billingAddress || null,
          addresses: userAddresses,
        };
      }
    }

    const allUserAddresses = await this.addressesService.listForUser(id);
    const defaultAddr = allUserAddresses.find((a) => a.isDefault) || allUserAddresses[0] || null;

    let finalAvatarUrl = user.avatarUrl;
    if (this.storageService) {
      if (finalAvatarUrl) {
        finalAvatarUrl = await this.storageService.getSignedUrl(finalAvatarUrl);
      }
      if (profile?.avatarUrl) {
        profile.avatarUrl = await this.storageService.getSignedUrl(profile.avatarUrl);
      }
      if (profile?.bannerUrl) {
        profile.bannerUrl = await this.storageService.getSignedUrl(profile.bannerUrl);
      }
    }

    return {
      ...user,
      avatarUrl: finalAvatarUrl,
      phone: user.phoneNumber,
      addressDetails: defaultAddr,
      addresses: allUserAddresses,
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

    // Persist structured address in AddressEntity table
    if (dto.address) {
      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        savedUser.id,
        dto.address,
        AddressType.SHIPPING,
        {
          recipientName: `${savedUser.firstName} ${savedUser.lastName}`,
          phoneNumber: savedUser.phoneNumber || undefined,
          label: dto.companyName || 'Exploitation',
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      );
    }

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
      country: dto.country || 'COD',
      preferredCurrency: dto.preferredCurrency || 'CDF',
      roles: [buyerRole],
      status: UserStatus.APPROVED,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.buyerProfileRepository.create({
      userId: savedUser.id,
      companyName: dto.companyName ?? null,
      vatNumber: dto.vatNumber ?? null,
      businessType: dto.businessType ?? null,
      billingAddress: dto.billingAddress,
      shippingAddress: dto.shippingAddress,
    });

    await this.buyerProfileRepository.save(profile);

    // Persist structured shipping and billing addresses in AddressEntity table
    if (dto.shippingAddress) {
      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        savedUser.id,
        dto.shippingAddress,
        AddressType.SHIPPING,
        {
          recipientName: `${savedUser.firstName} ${savedUser.lastName}`,
          phoneNumber: savedUser.phoneNumber || undefined,
          country: dto.country || 'COD',
          label: 'Adresse de livraison',
        },
      );
    }
    if (dto.billingAddress && dto.billingAddress !== dto.shippingAddress) {
      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        savedUser.id,
        dto.billingAddress,
        AddressType.BILLING,
        {
          recipientName: `${savedUser.firstName} ${savedUser.lastName}`,
          phoneNumber: savedUser.phoneNumber || undefined,
          country: dto.country || 'COD',
          label: 'Adresse de facturation',
        },
      );
    }

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

  async getFarmerProfile(userIdOrId: string): Promise<FarmerProfileEntity> {
    const profile = await this.farmerProfileRepository.findOne({
      where: [{ userId: userIdOrId }, { id: userIdOrId }],
      relations: ['user', 'parcels'],
    });
    if (!profile) {
      throw new NotFoundException('Farmer profile not found');
    }

    // Hydrate address from AddressEntity table if present
    const addresses = await this.addressesService.listForUser(profile.userId);
    const primary = addresses.find((a) => a.isDefault) || addresses[0];
    if (primary) {
      profile.address = [
        primary.streetAddress,
        primary.streetAddress2,
        primary.city,
        primary.stateOrProvince,
        primary.country,
      ]
        .filter(Boolean)
        .join(', ');
    }

    if (this.storageService) {
      if (profile.avatarUrl) {
        profile.avatarUrl = await this.storageService.getSignedUrl(profile.avatarUrl);
      }
      if (profile.bannerUrl) {
        profile.bannerUrl = await this.storageService.getSignedUrl(profile.bannerUrl);
      }
      if (profile.user?.avatarUrl) {
        profile.user.avatarUrl = await this.storageService.getSignedUrl(profile.user.avatarUrl);
      }
    }

    (profile as any).addressDetails = primary || null;
    (profile as any).addresses = addresses;
    (profile as any).phoneNumber = profile.user?.phoneNumber || primary?.phoneNumber || null;

    return profile;
  }

  async getFarmerProfileById(id: string): Promise<FarmerProfileEntity> {
    const profile = await this.farmerProfileRepository.findOne({
      where: [{ id }, { userId: id }],
      relations: ['user', 'parcels'],
    });
    if (!profile) {
      throw new NotFoundException('Farmer profile not found');
    }

    // Hydrate address from AddressEntity table if present
    const addresses = await this.addressesService.listForUser(profile.userId);
    const primary = addresses.find((a) => a.isDefault) || addresses[0];
    if (primary) {
      profile.address = [
        primary.streetAddress,
        primary.streetAddress2,
        primary.city,
        primary.stateOrProvince,
        primary.country,
      ]
        .filter(Boolean)
        .join(', ');
    }

    if (this.storageService) {
      if (profile.avatarUrl) {
        profile.avatarUrl = await this.storageService.getSignedUrl(profile.avatarUrl);
      }
      if (profile.bannerUrl) {
        profile.bannerUrl = await this.storageService.getSignedUrl(profile.bannerUrl);
      }
      if (profile.user?.avatarUrl) {
        profile.user.avatarUrl = await this.storageService.getSignedUrl(profile.user.avatarUrl);
      }
    }

    (profile as any).addressDetails = primary || null;
    (profile as any).addresses = addresses;

    return profile;
  }

  async getBuyerProfile(userId: string): Promise<BuyerProfileEntity> {
    const profile = await this.buyerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Buyer profile not found');
    }

    // Hydrate addresses from AddressEntity table if present
    const addresses = await this.addressesService.listForUser(userId);
    const shipping = addresses.find((a) => a.type === AddressType.SHIPPING && a.isDefault) ||
      addresses.find((a) => a.type === AddressType.SHIPPING) || addresses[0];
    const billing = addresses.find((a) => a.type === AddressType.BILLING && a.isDefault) ||
      addresses.find((a) => a.type === AddressType.BILLING) || shipping;

    const formatAddr = (addr?: typeof shipping) =>
      addr
        ? [addr.streetAddress, addr.streetAddress2, addr.city, addr.stateOrProvince, addr.country]
            .filter(Boolean)
            .join(', ')
        : '';

    if (shipping) profile.shippingAddress = formatAddr(shipping) || profile.shippingAddress;
    if (billing) profile.billingAddress = formatAddr(billing) || profile.billingAddress;

    (profile as any).shippingAddressDetails = shipping || null;
    (profile as any).billingAddressDetails = billing || null;
    (profile as any).addresses = addresses;

    return profile;
  }

  async updateFarmerProfile(
    userIdOrId: string,
    dto: UpdateFarmerProfileDto,
  ): Promise<FarmerProfileEntity> {
    const profile = await this.getFarmerProfile(userIdOrId);
    const user = await this.usersRepository.findOneBy({ id: profile.userId });
    if (user) {
      if (dto.firstName !== undefined) user.firstName = dto.firstName;
      if (dto.lastName !== undefined) user.lastName = dto.lastName;
      if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber || null;
      if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl || null;
      await this.usersRepository.save(user);
    }

    if (dto.companyName !== undefined) profile.companyName = dto.companyName;
    if (dto.address !== undefined) {
      profile.address = typeof dto.address === 'string' ? dto.address : profile.address;
    }
    if (dto.regionName !== undefined) {
      profile.regionName = dto.regionName ? dto.regionName.trim() : null;
    }
    profile.bio = dto.bio ?? null;
    if (dto.avatarUrl !== undefined) {
      profile.avatarUrl = dto.avatarUrl || null;
    }
    if (dto.bannerUrl !== undefined) {
      profile.bannerUrl = dto.bannerUrl || null;
    }
    if (dto.isCertified !== undefined) {
      profile.isCertified = dto.isCertified;
    }
    await this.farmerProfileRepository.save(profile);

    // Sync to AddressEntity table
    const addressInput = (dto as any).addressDetails || dto.address;
    if (addressInput) {
      const extra: Record<string, any> = {};
      if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
      if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;
      if (dto.companyName || profile.companyName) extra.label = dto.companyName || profile.companyName;

      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        profile.userId,
        addressInput,
        AddressType.SHIPPING,
        extra,
      );
    }

    return this.getFarmerProfile(profile.userId);
  }

  async updateBuyerProfile(
    userId: string,
    dto: UpdateBuyerProfileDto,
  ): Promise<BuyerProfileEntity> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    const profile = await this.getBuyerProfile(userId);
    if (dto.companyName !== undefined) profile.companyName = dto.companyName || null;
    if (dto.vatNumber !== undefined) profile.vatNumber = dto.vatNumber || null;
    if (dto.businessType !== undefined) profile.businessType = dto.businessType || null;
    if (dto.billingAddress !== undefined) {
      profile.billingAddress = typeof dto.billingAddress === 'string' ? dto.billingAddress : profile.billingAddress;
    }
    if (dto.shippingAddress !== undefined) {
      profile.shippingAddress = typeof dto.shippingAddress === 'string' ? dto.shippingAddress : profile.shippingAddress;
    }
    await this.buyerProfileRepository.save(profile);

    // Sync to AddressEntity table
    const shippingInput = (dto as any).shippingAddressDetails || dto.shippingAddress;
    if (shippingInput) {
      const extra: Record<string, any> = { label: 'Adresse de livraison' };
      if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
      if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;

      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        userId,
        shippingInput,
        AddressType.SHIPPING,
        extra,
      );
    }
    const billingInput = (dto as any).billingAddressDetails || dto.billingAddress;
    if (billingInput) {
      const extra: Record<string, any> = { label: 'Adresse de facturation' };
      if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
      if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;

      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        userId,
        billingInput,
        AddressType.BILLING,
        extra,
      );
    }

    return this.getBuyerProfile(userId);
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

    // Persist structured address in AddressEntity table
    if (dto.address) {
      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        savedUser.id,
        dto.address,
        AddressType.SHIPPING,
        {
          recipientName: `${savedUser.firstName} ${savedUser.lastName}`,
          phoneNumber: savedUser.phoneNumber || undefined,
          label: companyName,
        },
      );
    }

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
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl || null;
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
        if (dto.licenseExpiresAt !== undefined) driverProfile.licenseExpiresAt = dto.licenseExpiresAt || null;
        if (dto.isAvailable !== undefined) driverProfile.isAvailable = dto.isAvailable;
        await this.driverProfileRepository.save(driverProfile);
      }

      if (dto.vehicleBrand !== undefined || dto.vehiclePlate !== undefined) {
        let vehicle = await this.vehicleRepository.findOne({
          where: { currentDriverId: id, isActive: true },
        });
        if (!vehicle && dto.vehiclePlate) {
          vehicle = this.vehicleRepository.create({
            currentDriverId: id,
            brand: dto.vehicleBrand || null,
            registrationPlate: dto.vehiclePlate,
            type: VehicleType.VAN,
            capacityKg: 1500,
            capacityM3: 6,
            isActive: true,
          });
          await this.vehicleRepository.save(vehicle);
        } else if (vehicle) {
          if (dto.vehicleBrand !== undefined) vehicle.brand = dto.vehicleBrand || null;
          if (dto.vehiclePlate !== undefined) vehicle.registrationPlate = dto.vehiclePlate;
          await this.vehicleRepository.save(vehicle);
        }
      }
    } else if (roleNames.includes('Farmer')) {
      const farmerProfile = await this.farmerProfileRepository.findOneBy({ userId: id });
      if (farmerProfile) {
        if (dto.companyName !== undefined) farmerProfile.companyName = dto.companyName;
        if (dto.address !== undefined) {
          farmerProfile.address = typeof dto.address === 'string' ? dto.address : farmerProfile.address;
        }
        if (dto.regionName !== undefined) farmerProfile.regionName = dto.regionName ? dto.regionName.trim() : null;
        if (dto.bio !== undefined) farmerProfile.bio = dto.bio;
        if (dto.isCertified !== undefined) farmerProfile.isCertified = dto.isCertified;
        if (dto.avatarUrl !== undefined) farmerProfile.avatarUrl = dto.avatarUrl || null;
        if (dto.bannerUrl !== undefined) farmerProfile.bannerUrl = dto.bannerUrl || null;
        await this.farmerProfileRepository.save(farmerProfile);

        const addressInput = (dto as any).addressDetails || dto.address;
        if (addressInput) {
          const extra: Record<string, any> = {};
          if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
          if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;
          if (farmerProfile.companyName) extra.label = farmerProfile.companyName;

          await this.addressesService.upsertPrimaryAddress(
            AddressableType.USER,
            id,
            addressInput,
            AddressType.SHIPPING,
            extra,
          );
        }
      }
    } else if (roleNames.includes('Buyer')) {
      const buyerProfile = await this.buyerProfileRepository.findOneBy({ userId: id });
      if (buyerProfile) {
        if (dto.companyName !== undefined) buyerProfile.companyName = dto.companyName;
        if (dto.vatNumber !== undefined) buyerProfile.vatNumber = dto.vatNumber;
        if (dto.billingAddress !== undefined) {
          buyerProfile.billingAddress = typeof dto.billingAddress === 'string' ? dto.billingAddress : buyerProfile.billingAddress;
        }
        if (dto.shippingAddress !== undefined) {
          buyerProfile.shippingAddress = typeof dto.shippingAddress === 'string' ? dto.shippingAddress : buyerProfile.shippingAddress;
        }
        await this.buyerProfileRepository.save(buyerProfile);

        const shippingInput = (dto as any).shippingAddressDetails || dto.shippingAddress;
        if (shippingInput) {
          const extra: Record<string, any> = { label: 'Adresse de livraison' };
          if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
          if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;

          await this.addressesService.upsertPrimaryAddress(
            AddressableType.USER,
            id,
            shippingInput,
            AddressType.SHIPPING,
            extra,
          );
        }
        const billingInput = (dto as any).billingAddressDetails || dto.billingAddress;
        if (billingInput) {
          const extra: Record<string, any> = { label: 'Adresse de facturation' };
          if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
          if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;

          await this.addressesService.upsertPrimaryAddress(
            AddressableType.USER,
            id,
            billingInput,
            AddressType.BILLING,
            extra,
          );
        }
      }
    }

    if ((dto as any).addressDetails && !roleNames.includes('Farmer')) {
      const extra: Record<string, any> = {};
      if (user) extra.recipientName = `${user.firstName} ${user.lastName}`;
      if (user?.phoneNumber) extra.phoneNumber = user.phoneNumber;

      await this.addressesService.upsertPrimaryAddress(
        AddressableType.USER,
        id,
        (dto as any).addressDetails,
        AddressType.SHIPPING,
        extra,
      );
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

    // If vehicle details were provided, register and assign the vehicle to the driver
    if (dto.vehiclePlate) {
      const existingVehicle = await this.vehicleRepository.findOne({
        where: { registrationPlate: dto.vehiclePlate },
      });
      if (existingVehicle) {
        throw new ConflictException(
          `Vehicle with plate "${dto.vehiclePlate}" already exists`,
        );
      }

      const vehicle = this.vehicleRepository.create({
        brand: dto.vehicleBrand || null,
        registrationPlate: dto.vehiclePlate,
        type: (dto.vehicleType as VehicleType) || VehicleType.VAN,
        capacityKg: dto.vehicleCapacityKg ? Number(dto.vehicleCapacityKg) : 1000,
        capacityM3: dto.vehicleCapacityM3 ? Number(dto.vehicleCapacityM3) : 5,
        isActive: true,
        currentDriverId: savedUser.id,
      });
      await this.vehicleRepository.save(vehicle);
    }

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

  async updatePreferences(
    userId: string,
    dto: { country?: string; preferredCurrency?: string },
  ): Promise<{ country: string; preferredCurrency: string }> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.country) {
      user.country = dto.country.toUpperCase();
    }
    if (dto.preferredCurrency) {
      user.preferredCurrency = dto.preferredCurrency.toUpperCase();
    }
    await this.usersRepository.save(user);
    return {
      country: user.country,
      preferredCurrency: user.preferredCurrency,
    };
  }

  async getPaymentMethod(userId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      hasPaymentMethod: !!user.stripePaymentMethodId,
      brand: user.cardBrand || null,
      last4: user.cardLast4 || null,
      expMonth: user.cardExpMonth || null,
      expYear: user.cardExpYear || null,
    };
  }

  async createSetupIntent(userId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.stripeCustomerId) {
      const customer = await this.stripePaymentGateway.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userId: user.id,
      });
      user.stripeCustomerId = customer.id;
      await this.usersRepository.save(user);
    }

    const { clientSecret } = await this.stripePaymentGateway.createSetupIntent(user.stripeCustomerId);
    return { clientSecret };
  }

  async attachPaymentMethod(userId: string, paymentMethodId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.stripeCustomerId) {
      const customer = await this.stripePaymentGateway.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userId: user.id,
      });
      user.stripeCustomerId = customer.id;
    }

    const pm = await this.stripePaymentGateway.attachPaymentMethod(user.stripeCustomerId, paymentMethodId);
    user.stripePaymentMethodId = pm.id;
    user.cardBrand = pm.brand;
    user.cardLast4 = pm.last4;
    user.cardExpMonth = pm.expMonth;
    user.cardExpYear = pm.expYear;
    await this.usersRepository.save(user);

    return {
      hasPaymentMethod: true,
      brand: user.cardBrand,
      last4: user.cardLast4,
      expMonth: user.cardExpMonth,
      expYear: user.cardExpYear,
    };
  }

  async createSetupSession(
    userId: string,
    options?: {
      returnUrl?: string | undefined;
      auctionId?: string | undefined;
      clientOrigin?: string | undefined;
    },
  ) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.stripeCustomerId) {
      const customer = await this.stripePaymentGateway.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userId: user.id,
      });
      user.stripeCustomerId = customer.id;
      await this.usersRepository.save(user);
    }

    const defaultOrigin =
      options?.clientOrigin ||
      this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3001').split(',')[0] ||
      'http://localhost:3001';

    let successUrl = options?.returnUrl;
    let cancelUrl = options?.returnUrl;

    if (!successUrl) {
      successUrl = options?.auctionId
        ? `${defaultOrigin}/auctions/${options.auctionId}`
        : `${defaultOrigin}/auctions`;
    }
    if (!cancelUrl) {
      cancelUrl = options?.auctionId
        ? `${defaultOrigin}/auctions/${options.auctionId}`
        : `${defaultOrigin}/auctions`;
    }

    const setupParams: {
      customerId: string;
      successUrl: string;
      cancelUrl: string;
      userId: string;
      metadata?: Record<string, string>;
    } = {
      customerId: user.stripeCustomerId!,
      successUrl,
      cancelUrl,
      userId: user.id,
    };

    if (options?.auctionId) {
      setupParams.metadata = { auctionId: options.auctionId };
    }

    return this.stripePaymentGateway.createSetupCheckoutSession(setupParams);
  }

  async confirmSetupSession(userId: string, sessionId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pm = await this.stripePaymentGateway.confirmSetupCheckoutSession(sessionId);

    user.stripePaymentMethodId = pm.paymentMethodId;
    user.cardBrand = pm.brand;
    user.cardLast4 = pm.last4;
    user.cardExpMonth = pm.expMonth;
    user.cardExpYear = pm.expYear;
    await this.usersRepository.save(user);

    return {
      hasPaymentMethod: true,
      brand: user.cardBrand,
      last4: user.cardLast4,
      expMonth: user.cardExpMonth,
      expYear: user.cardExpYear,
    };
  }

  async detachPaymentMethod(userId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.stripePaymentMethodId) {
      await this.stripePaymentGateway.detachPaymentMethod(user.stripePaymentMethodId);
      user.stripePaymentMethodId = null;
      user.cardBrand = null;
      user.cardLast4 = null;
      user.cardExpMonth = null;
      user.cardExpYear = null;
      await this.usersRepository.save(user);
    }
    return { success: true };
  }
}
