import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  UserStatus,
  FeeCalculationType,
} from '@futurefarm/types';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/roles/entities/role.entity';
import { PlatformFeeEntity } from '../modules/fees/entities/platform-fee.entity';
import { CurrencyEntity } from '../modules/currencies/entities/currency.entity';
import { INITIAL_CURRENCIES } from '../modules/currencies/currencies.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Checking production baseline database seeding...');

    // 1. Define permission list constants
    const userPermissions = [
      Permission.USER_READ,
      Permission.ROLE_READ,
    ];

    const farmerPermissions = [
      Permission.PROFILE_UPDATE,
      Permission.PARCEL_CREATE,
      Permission.SESSION_MANAGE,
      Permission.NOTIFICATION_READ,
      Permission.NOTIFICATION_DELETE_OWN,
      Permission.PRODUCT_READ,
      Permission.PRODUCT_CREATE,
      Permission.HARVEST_CREATE,
      Permission.HARVEST_READ,
      Permission.HARVEST_UPDATE,
      Permission.HARVEST_DELETE,
      Permission.AUCTION_CREATE,
      Permission.AUCTION_UPDATE,
      Permission.ORDER_READ,
      Permission.ORDER_READ_SELLER,
      Permission.ORDER_CONFIRM,
      Permission.ORDER_REJECT,
      Permission.ORDER_SHIP,
      Permission.ORDER_DELIVER,
      Permission.VISIT_READ,
    ];

    const buyerPermissions = [
      Permission.PROFILE_UPDATE,
      Permission.SESSION_MANAGE,
      Permission.NOTIFICATION_READ,
      Permission.NOTIFICATION_DELETE_OWN,
      Permission.PRODUCT_READ,
      Permission.ORDER_CREATE,
      Permission.ORDER_READ,
      Permission.BID_CREATE,
      Permission.BID_READ,
      Permission.BID_CANCEL,
      Permission.BASKET_MANAGE,
      Permission.ORDER_CANCEL,
      Permission.DRIVER_LOCATION_READ,
    ];

    const inspectorPermissions = [
      Permission.USER_READ,
      Permission.PRODUCT_READ,
      Permission.PRODUCT_CREATE,
      Permission.HARVEST_CREATE,
      Permission.PARCEL_VERIFY,
      Permission.SESSION_MANAGE,
      Permission.NOTIFICATION_READ,
      Permission.NOTIFICATION_DELETE_OWN,
      Permission.FARMER_PROXY_CREATE,
      Permission.FARMER_PROXY_UPDATE,
      Permission.FARMER_PROXY_HARVEST_MANAGE,
      Permission.FARMER_PROXY_AUCTION_MANAGE,
      Permission.INSPECTION_CENTER_READ,
      Permission.INSPECTION_CENTER_ASSIGN,
      Permission.INSPECTION_CREATE,
      Permission.INSPECTION_READ,
      Permission.INSPECTION_READ_ALL,
      Permission.INSPECTION_UPDATE,
      Permission.INSPECTOR_PROFILE_READ,
      Permission.INSPECTOR_PROFILE_UPDATE,
      Permission.PRODUCT_READ,
      Permission.PRODUCT_CREATE,
      Permission.HARVEST_CREATE,
      Permission.HARVEST_READ,
      Permission.HARVEST_UPDATE,
      Permission.HARVEST_DELETE,
      Permission.HARVEST_VERIFY,
      Permission.HARVEST_READ_ALL,
      Permission.USER_VALIDATE,
      Permission.VISIT_CREATE,
      Permission.VISIT_READ,
      Permission.VISIT_UPDATE,
      Permission.VISIT_DELETE,
      Permission.DASHBOARD_READ,
      Permission.DISPUTE_READ,
    ];

    const driverPermissions = [
      Permission.DELIVERY_RUN_READ,
      Permission.DELIVERY_STOP_UPDATE,
      Permission.DRIVER_LOCATION_PUSH,
      Permission.DRIVER_LOCATION_READ,
      Permission.VEHICLE_READ,
      Permission.INSPECTION_CREATE,
      Permission.INSPECTION_READ,
      Permission.ORDER_READ,
      Permission.PROFILE_UPDATE,
      Permission.SESSION_MANAGE,
      Permission.NOTIFICATION_READ,
      Permission.NOTIFICATION_DELETE_OWN,
      Permission.DRIVER_PROFILE_READ,
      Permission.DRIVER_PROFILE_UPDATE,
    ];

    // =========================================================================
    // 1. Seed & Sync System Roles
    // =========================================================================
    const roleDefinitions = [
      {
        name: 'Admin',
        description: 'Administrator role with all permissions',
        permissions: Object.values(Permission),
      },
      {
        name: 'User',
        description: 'Regular user role with read-only permissions',
        permissions: userPermissions,
      },
      {
        name: 'Farmer',
        description: 'Local agricultural producer with land parcels',
        permissions: farmerPermissions,
      },
      {
        name: 'Buyer',
        description: 'Wholesale, restaurant, or industrial buyer',
        permissions: buyerPermissions,
      },
      {
        name: 'Inspector',
        description: 'Quality inspector with validation rights',
        permissions: inspectorPermissions,
      },
      {
        name: 'Driver',
        description: 'Fleet driver role',
        permissions: driverPermissions,
      },
    ];

    let adminRole: RoleEntity | null = null;

    for (const rDef of roleDefinitions) {
      let role = await this.roleRepository.findOne({ where: { name: rDef.name } });
      if (!role) {
        role = this.roleRepository.create(rDef);
        role = await this.roleRepository.save(role);
      } else {
        role.permissions = rDef.permissions;
        role.description = rDef.description;
        role = await this.roleRepository.save(role);
      }

      if (role.name === 'Admin') {
        adminRole = role;
      }
    }
    this.logger.log('System roles verified and synchronized.');

    // =========================================================================
    // 2. Seed Admin User (Only Admin user in production baseline)
    // =========================================================================
    if (adminRole) {
      let adminUser = await this.userRepository.findOne({
        where: { email: 'admin@futurefarm.local' },
      });
      if (!adminUser) {
        adminUser = this.userRepository.create({
          email: 'admin@futurefarm.local',
          password: 'password', // will be hashed by @BeforeInsert
          firstName: 'Admin',
          lastName: 'User',
          phoneNumber: '+243990000000',
          country: 'COD',
          preferredCurrency: 'CDF',
          roles: [adminRole],
          isActive: true,
          status: UserStatus.APPROVED,
        });
        await this.userRepository.save(adminUser);
        this.logger.log('Default Admin user created (admin@futurefarm.local / password)');
      }
    }

    // =========================================================================
    // 3. Seed Currencies and Exchange Rates
    // =========================================================================
    const currencyRepo = this.userRepository.manager.getRepository(CurrencyEntity);
    this.logger.log('Ensuring default currencies and exchange rates...');
    for (const cur of INITIAL_CURRENCIES) {
      if (!cur.code) continue;
      const existingCur = await currencyRepo.findOne({ where: { code: cur.code } });
      if (!existingCur) {
        await currencyRepo.save(currencyRepo.create(cur));
      }
    }
    this.logger.log('Currencies verified successfully.');

    // =========================================================================
    // 4. Seed Platform Fees (Configurable additional fees)
    // =========================================================================
    const feeRepo = this.userRepository.manager.getRepository(PlatformFeeEntity);
    this.logger.log('Ensuring default platform fees...');
    const defaultFees: Array<{
      name: string;
      code: string;
      calculationType: FeeCalculationType;
      value: number;
      currency: string;
      isActive: boolean;
      description: string;
      displayOrder: number;
    }> = [
      {
        name: 'Frais de livraison',
        code: 'DELIVERY',
        calculationType: FeeCalculationType.FIXED,
        value: 2.90,
        currency: 'USD',
        isActive: true,
        description: 'Frais de livraison logistique standard',
        displayOrder: 1,
      },
      {
        name: 'Frais de service',
        code: 'SERVICE',
        calculationType: FeeCalculationType.FIXED,
        value: 0.50,
        currency: 'USD',
        isActive: true,
        description: 'Frais de fonctionnement et maintenance de la plateforme',
        displayOrder: 2,
      },
      {
        name: 'TVA (Taxe sur la Valeur Ajoutée)',
        code: 'VAT',
        calculationType: FeeCalculationType.PERCENTAGE,
        value: 0.00,
        currency: 'USD',
        isActive: false,
        description: 'Taxe sur la valeur ajoutée appliquée au sous-total',
        displayOrder: 3,
      },
    ];

    for (const feeData of defaultFees) {
      const existingFee = await feeRepo.findOne({ where: { code: feeData.code } });
      if (!existingFee) {
        const fee = feeRepo.create(feeData);
        await feeRepo.save(fee);
      }
    }
    this.logger.log('Platform fees verified successfully.');
    this.logger.log('Production baseline database seeding complete.');
  }
}
