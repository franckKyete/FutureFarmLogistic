import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, ProductCategory } from '@futurefarm/types';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/roles/entities/role.entity';
import { ProductEntity } from '../modules/products/entities/product.entity';

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
    this.logger.log('Checking if database needs seeding...');

    // Define permission list constants
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
      Permission.BASKET_MANAGE,
    ];

    const inspectorPermissions = [
      Permission.USER_READ,
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

    // 1. Seed Roles
    const roleCount = await this.roleRepository.count();
    let adminRole: RoleEntity | null;
    let userRole: RoleEntity | null;

    if (roleCount === 0) {
      this.logger.log('Seeding default roles...');

      const adminRoleToCreate = this.roleRepository.create({
        name: 'Admin',
        description: 'Administrator role with all permissions',
        permissions: Object.values(Permission),
      });
      adminRole = await this.roleRepository.save(adminRoleToCreate);

      const userRoleToCreate = this.roleRepository.create({
        name: 'User',
        description: 'Regular user role with read-only permissions',
        permissions: userPermissions,
      });
      userRole = await this.roleRepository.save(userRoleToCreate);

      const farmerRoleToCreate = this.roleRepository.create({
        name: 'Farmer',
        description: 'Local agricultural producer with land parcels',
        permissions: farmerPermissions,
      });
      await this.roleRepository.save(farmerRoleToCreate);

      const buyerRoleToCreate = this.roleRepository.create({
        name: 'Buyer',
        description: 'Wholesale, restaurant, or industrial buyer',
        permissions: buyerPermissions,
      });
      await this.roleRepository.save(buyerRoleToCreate);

      const inspectorRoleToCreate = this.roleRepository.create({
        name: 'Inspector',
        description: 'Quality inspector with validation rights',
        permissions: inspectorPermissions,
      });
      await this.roleRepository.save(inspectorRoleToCreate);

      const driverRoleToCreate = this.roleRepository.create({
        name: 'Driver',
        description: 'Fleet driver role',
        permissions: driverPermissions,
      });
      await this.roleRepository.save(driverRoleToCreate);

      this.logger.log('Default roles seeded successfully.');
    } else {
      adminRole = await this.roleRepository.findOne({
        where: { name: 'Admin' },
      });
      userRole = await this.roleRepository.findOne({ where: { name: 'User' } });

      // Always sync / update permissions for existing Farmer role
      let farmer = await this.roleRepository.findOneBy({ name: 'Farmer' });
      if (!farmer) {
        farmer = this.roleRepository.create({
          name: 'Farmer',
          description: 'Local agricultural producer with land parcels',
        });
      }
      farmer.permissions = farmerPermissions;
      await this.roleRepository.save(farmer);

      // Always sync / update permissions for existing Buyer role
      let buyer = await this.roleRepository.findOneBy({ name: 'Buyer' });
      if (!buyer) {
        buyer = this.roleRepository.create({
          name: 'Buyer',
          description: 'Wholesale, restaurant, or industrial buyer',
        });
      }
      buyer.permissions = buyerPermissions;
      await this.roleRepository.save(buyer);

      // Always sync / update permissions for existing Inspector role
      let inspector = await this.roleRepository.findOneBy({ name: 'Inspector' });
      if (!inspector) {
        inspector = this.roleRepository.create({
          name: 'Inspector',
          description: 'Quality inspector with validation rights',
        });
      }
      inspector.permissions = inspectorPermissions;
      await this.roleRepository.save(inspector);

      // Always sync / update permissions for existing Driver role
      let driver = await this.roleRepository.findOneBy({ name: 'Driver' });
      if (!driver) {
        driver = this.roleRepository.create({
          name: 'Driver',
          description: 'Fleet driver role',
        });
      }
      driver.permissions = driverPermissions;
      await this.roleRepository.save(driver);
    }

    // 2. Seed Users
    const userCount = await this.userRepository.count();
    if (userCount === 0) {
      this.logger.log('Seeding default users...');

      if (adminRole) {
        const adminUser = this.userRepository.create({
          email: 'admin@futurefarm.local',
          password: 'password', // will be hashed by @BeforeInsert
          firstName: 'Admin',
          lastName: 'User',
          roles: [adminRole],
          isActive: true,
        });
        await this.userRepository.save(adminUser);
        this.logger.log(
          'Default Admin user created (admin@futurefarm.local / password)',
        );
      }

      if (userRole) {
        const regularUser = this.userRepository.create({
          email: 'user@futurefarm.local',
          password: 'password', // will be hashed by @BeforeInsert
          firstName: 'Regular',
          lastName: 'User',
          roles: [userRole],
          isActive: true,
        });
        await this.userRepository.save(regularUser);
        this.logger.log(
          'Default Regular user created (user@futurefarm.local / password)',
        );
      }
    }

    // 3. Seed Products
    const productRepository = this.userRepository.manager.getRepository(ProductEntity);
    const productCount = await productRepository.count();
    if (productCount === 0) {
      this.logger.log('Seeding default product crop templates...');
      const defaultProducts = [
        { name: 'Soja', description: 'Graines de soja locales', category: ProductCategory.CEREALS },
        { name: 'Maïs', description: 'Épis de maïs doux', category: ProductCategory.CEREALS },
        { name: 'Tomates', description: 'Tomates fraîches cultivées en champ', category: ProductCategory.VEGETABLES },
        { name: 'Dattes Medjool', description: 'Dattes Medjool de qualité supérieure', category: ProductCategory.DATES },
        { name: 'Pommes', description: 'Pommes rouges juteuses', category: ProductCategory.FRUITS },
        { name: 'Lait Frais', description: 'Lait de vache pasteurisé', category: ProductCategory.DAIRY },
      ];
      for (const prod of defaultProducts) {
        await productRepository.save(productRepository.create(prod));
      }
      this.logger.log('Default product templates seeded.');
    }
  }
}
