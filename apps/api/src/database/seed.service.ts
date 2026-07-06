import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '@futurefarm/types';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/roles/entities/role.entity';

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
        permissions: [
          Permission.USER_READ,
          Permission.ROLE_READ,
        ],
      });
      userRole = await this.roleRepository.save(userRoleToCreate);

      const farmerRoleToCreate = this.roleRepository.create({
        name: 'Farmer',
        description: 'Local agricultural producer with land parcels',
        permissions: [
          Permission.PROFILE_UPDATE,
          Permission.PARCEL_CREATE,
          Permission.SESSION_MANAGE,
          Permission.NOTIFICATION_READ,
          Permission.NOTIFICATION_DELETE_OWN,
        ],
      });
      await this.roleRepository.save(farmerRoleToCreate);

      const buyerRoleToCreate = this.roleRepository.create({
        name: 'Buyer',
        description: 'Wholesale, restaurant, or industrial buyer',
        permissions: [
          Permission.PROFILE_UPDATE,
          Permission.SESSION_MANAGE,
          Permission.NOTIFICATION_READ,
          Permission.NOTIFICATION_DELETE_OWN,
        ],
      });
      await this.roleRepository.save(buyerRoleToCreate);

      const inspectorRoleToCreate = this.roleRepository.create({
        name: 'Inspector',
        description: 'Quality inspector with validation rights',
        permissions: [
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
        ],
      });
      await this.roleRepository.save(inspectorRoleToCreate);

      const driverRoleToCreate = this.roleRepository.create({
        name: 'Driver',
        description: 'Fleet driver role',
        permissions: [
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
        ],
      });
      await this.roleRepository.save(driverRoleToCreate);

      this.logger.log('Default roles seeded successfully.');
    } else {
      adminRole = await this.roleRepository.findOne({
        where: { name: 'Admin' },
      });
      userRole = await this.roleRepository.findOne({ where: { name: 'User' } });

      // Ensure Farmer, Buyer, Inspector, Driver exist even if some roles are already seeded
      const farmerExists = await this.roleRepository.existsBy({
        name: 'Farmer',
      });
      if (!farmerExists) {
        const r = this.roleRepository.create({
          name: 'Farmer',
          description: 'Local agricultural producer with land parcels',
          permissions: [
            Permission.PROFILE_UPDATE,
            Permission.PARCEL_CREATE,
            Permission.SESSION_MANAGE,
            Permission.NOTIFICATION_READ,
            Permission.NOTIFICATION_DELETE_OWN,
          ],
        });
        await this.roleRepository.save(r);
      }
      const buyerExists = await this.roleRepository.existsBy({ name: 'Buyer' });
      if (!buyerExists) {
        const r = this.roleRepository.create({
          name: 'Buyer',
          description: 'Wholesale, restaurant, or industrial buyer',
          permissions: [
            Permission.PROFILE_UPDATE,
            Permission.SESSION_MANAGE,
            Permission.NOTIFICATION_READ,
            Permission.NOTIFICATION_DELETE_OWN,
          ],
        });
        await this.roleRepository.save(r);
      }
      const inspectorExists = await this.roleRepository.existsBy({
        name: 'Inspector',
      });
      if (!inspectorExists) {
        const r = this.roleRepository.create({
          name: 'Inspector',
          description: 'Quality inspector with validation rights',
          permissions: [
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
          ],
        });
        await this.roleRepository.save(r);
      }
      const driverExists = await this.roleRepository.existsBy({
        name: 'Driver',
      });
      if (!driverExists) {
        const r = this.roleRepository.create({
          name: 'Driver',
          description: 'Fleet driver role',
          permissions: [
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
          ],
        });
        await this.roleRepository.save(r);
      }
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
  }
}
