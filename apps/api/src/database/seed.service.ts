import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  ProductCategory,
  DisputeStatus,
  DisputeSeverity,
  DeliveryRunStatus,
  DeliveryStopType,
  DeliveryStopStatus,
  VehicleType,
  AuctionStatus,
  InspectionStatus,
  OrderStatus,
  PaymentStatus,
  OrderLineStatus,
  HarvestStatus,
  HarvestUnit,
  UserStatus,
} from '@futurefarm/types';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/roles/entities/role.entity';
import { ProductEntity } from '../modules/products/entities/product.entity';
import { DisputeEntity } from '../modules/disputes/entities/dispute.entity';
import { DriverProfileEntity } from '../modules/logistics/entities/driver-profile.entity';
import { VehicleEntity } from '../modules/logistics/entities/vehicle.entity';
import { DeliveryRunEntity } from '../modules/logistics/entities/delivery-run.entity';
import { DeliveryStopEntity } from '../modules/logistics/entities/delivery-stop.entity';
import { InspectionCenterEntity } from '../modules/inspections/entities/inspection-center.entity';
import { InspectorProfileEntity } from '../modules/inspections/entities/inspector-profile.entity';
import { InspectorCenterAssignmentEntity } from '../modules/inspections/entities/inspector-center-assignment.entity';
import { InspectionReportEntity } from '../modules/inspections/entities/inspection-report.entity';
import { InspectionPhotoEntity } from '../modules/inspections/entities/inspection-photo.entity';
import { AuctionEntity } from '../modules/auctions/entities/auction.entity';
import { HarvestEntity } from '../modules/products/entities/harvest.entity';
import { FarmerProfileEntity } from '../modules/users/entities/farmer-profile.entity';
import { OrderEntity } from '../modules/orders/entities/order.entity';
import { OrderLineEntity } from '../modules/orders/entities/order-line.entity';

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
      Permission.BID_CANCEL,
      Permission.BASKET_MANAGE,
      Permission.ORDER_CANCEL,
      Permission.DRIVER_LOCATION_READ,
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
      Permission.INSPECTION_CREATE,
      Permission.INSPECTION_READ,
      Permission.INSPECTION_READ_ALL,
      Permission.INSPECTION_UPDATE,
      Permission.INSPECTOR_PROFILE_READ,
      Permission.INSPECTOR_PROFILE_UPDATE,
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
          status: UserStatus.APPROVED,
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
          status: UserStatus.APPROVED,
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

    // 4. Seed Disputes
    const disputeRepository =
      this.userRepository.manager.getRepository(DisputeEntity);
    const disputeCount = await disputeRepository.count();
    if (disputeCount === 0) {
      this.logger.log('Seeding sample disputes...');

      const adminUser = await this.userRepository.findOne({
        where: { email: 'admin@futurefarm.local' },
      });

      if (adminUser) {
        const sampleDisputes = [
          {
            title: 'Livraison de produits abîmés',
            description:
              "Les tomates livrées le 10 juillet présentent des signes d'écrasement et d'oxydation. Plus de 30% du lot est impropre à la vente. Le transporteur n'a pas respecté les consignes de manutention.",
            severity: DisputeSeverity.HIGH,
            status: DisputeStatus.OPEN,
            relatedType: 'order',
            relatedId: '00000000-0000-0000-0000-000000000001',
            createdById: adminUser.id,
          },
          {
            title: 'Désaccord sur le poids de la récolte',
            description:
              'Le poids déclaré à la pesée diffère de 150 kg par rapport au certificat de récolte du producteur. Une contre-expertise est demandée pour vérifier les balances utilisées.',
            severity: DisputeSeverity.MEDIUM,
            status: DisputeStatus.UNDER_REVIEW,
            relatedType: 'order',
            relatedId: '00000000-0000-0000-0000-000000000002',
            createdById: adminUser.id,
          },
          {
            title: 'Non-conformité du calibre des dattes',
            description:
              'Les dattes Medjool livrées ne correspondent pas au calibre commandé (taille 24-28 mm au lieu de 30-34 mm). Le client réclame un avoir proportionnel à la différence de qualité.',
            severity: DisputeSeverity.LOW,
            status: DisputeStatus.OPEN,
            relatedType: 'order',
            relatedId: '00000000-0000-0000-0000-000000000003',
            createdById: adminUser.id,
          },
        ];

        for (const dispute of sampleDisputes) {
          await disputeRepository.save(
            disputeRepository.create(dispute),
          );
        }
        this.logger.log('Sample disputes seeded successfully.');
      }
    }

    // =========================================================================
    // 5. Seed Farmers & Harvests (supporting data for orders, logistics, auctions)
    // =========================================================================
    const farmerProfileRepo = this.userRepository.manager.getRepository(FarmerProfileEntity);
    const farmerProfileCount = await farmerProfileRepo.count();
    let seededFarmerProfile: FarmerProfileEntity | null = null;

    if (farmerProfileCount === 0) {
      this.logger.log('Seeding farmer profile and harvests...');

      const farmerRole = await this.roleRepository.findOne({
        where: { name: 'Farmer' },
      });
      if (!farmerRole) {
        this.logger.warn('Farmer role not found, skipping farmer/harvest seed');
      } else {
        const farmerUser = this.userRepository.create({
          email: 'amadou.toure@futurefarm.local',
          password: 'password',
          firstName: 'Amadou',
          lastName: 'Touré',
          roles: [farmerRole],
          isActive: true,
          status: UserStatus.APPROVED,
        });
        await this.userRepository.save(farmerUser);

        const farmerProfile = farmerProfileRepo.create({
          userId: farmerUser.id,
          companyName: 'Ferme Agricole du Sénégal',
          address: 'Route de Rufisque, Dakar',
          isCertified: true,
          bio: 'Producteur de céréales et légumes biologiques depuis 2010',
        });
        seededFarmerProfile = await farmerProfileRepo.save(farmerProfile);

        // Create harvests using existing product templates
        const harvestRepository =
          this.userRepository.manager.getRepository(HarvestEntity);
        const productRepository =
          this.userRepository.manager.getRepository(ProductEntity);
        const products = await productRepository.find();

        const soja = products.find((p) => p.name === 'Soja');
        const tomates = products.find((p) => p.name === 'Tomates');
        const dattes = products.find((p) => p.name === 'Dattes Medjool');

        const harvestData = [];
        if (soja) {
          harvestData.push({
            productId: soja.id,
            farmerProfileId: seededFarmerProfile.id,
            harvestDate: new Date('2025-06-15'),
            expirationDate: new Date('2025-12-15'),
            quantityInStock: 5000,
            stockMarge: 100,
            pricePerUnit: 250,
            unit: HarvestUnit.KG,
            farmingMethods: 'Agriculture biologique, irrigation goutte à goutte',
            photoUrls: [],
            status: HarvestStatus.APPROVED,
            qualityScore: 4.5,
          });
        }
        if (tomates) {
          harvestData.push({
            productId: tomates.id,
            farmerProfileId: seededFarmerProfile.id,
            harvestDate: new Date('2025-07-01'),
            expirationDate: new Date('2025-07-21'),
            quantityInStock: 2000,
            stockMarge: 50,
            pricePerUnit: 150,
            unit: HarvestUnit.KG,
            farmingMethods: 'Culture en serre, sans pesticides',
            photoUrls: [],
            status: HarvestStatus.APPROVED,
            qualityScore: 4.2,
          });
        }
        if (dattes) {
          harvestData.push({
            productId: dattes.id,
            farmerProfileId: seededFarmerProfile.id,
            harvestDate: new Date('2025-06-20'),
            expirationDate: new Date('2026-06-20'),
            quantityInStock: 1000,
            stockMarge: 20,
            pricePerUnit: 1200,
            unit: HarvestUnit.KG,
            farmingMethods: 'Récolte manuelle, séchage naturel au soleil',
            photoUrls: [],
            status: HarvestStatus.APPROVED,
            qualityScore: 4.8,
          });
        }

        for (const h of harvestData) {
          await harvestRepository.save(harvestRepository.create(h));
        }
        this.logger.log(
          `Seeded ${harvestData.length} harvests for ${seededFarmerProfile.companyName}.`,
        );
      }
    } else {
      seededFarmerProfile = await farmerProfileRepo.findOne({ where: {}, relations: { user: true } });
    }

    // =========================================================================
    // 6. Seed Orders & Order Lines (for delivery stops)
    // =========================================================================
    const orderRepository = this.userRepository.manager.getRepository(OrderEntity);
    const orderCount = await orderRepository.count();

    if (orderCount === 0) {
      this.logger.log('Seeding order for delivery stops...');

      const buyerRole = await this.roleRepository.findOne({
        where: { name: 'Buyer' },
      });
      if (!buyerRole) {
        this.logger.warn('Buyer role not found, skipping order seed');
      } else if (!seededFarmerProfile) {
        this.logger.warn('Farmer profile not found, skipping order seed');
      } else {
        const buyerUser = this.userRepository.create({
          email: 'khadija.sy@futurefarm.local',
          password: 'password',
          firstName: 'Khadija',
          lastName: 'Sy',
          roles: [buyerRole],
          isActive: true,
          status: UserStatus.APPROVED,
        });
        await this.userRepository.save(buyerUser);

        const harvestRepo =
          this.userRepository.manager.getRepository(HarvestEntity);
        const harvests = await harvestRepo.find({
          relations: { product: true },
          take: 2,
        });

        if (harvests.length < 1) {
          this.logger.warn('No harvests found, skipping order seed');
        } else {
          const order = orderRepository.create({
            buyerId: buyerUser.id,
            status: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            totalAmount:
              harvests.length >= 2
                ? 1000 * 250 + 500 * 150
                : harvests[0]!.quantityInStock * harvests[0]!.pricePerUnit,
            cancellationFee: 0,
            deliveryAddress: {
              street: '15 Avenue de la République',
              city: 'Dakar',
              country: 'Sénégal',
              postalCode: '12000',
            },
            notes: 'Livraison hebdomadaire - marché de Dakar',
          });
          await orderRepository.save(order);

          const orderLineRepo =
            this.userRepository.manager.getRepository(OrderLineEntity);

          const line1 = orderLineRepo.create({
            orderId: order.id,
            harvestId: harvests[0]!.id,
            farmerProfileId: seededFarmerProfile.id,
            quantity: 1000,
            unitPrice: harvests[0]!.pricePerUnit,
            totalPrice: 1000 * harvests[0]!.pricePerUnit,
            status: OrderLineStatus.CONFIRMED,
          });
          await orderLineRepo.save(line1);

          if (harvests.length >= 2) {
            const line2 = orderLineRepo.create({
              orderId: order.id,
              harvestId: harvests[1]!.id,
              farmerProfileId: seededFarmerProfile.id,
              quantity: 500,
              unitPrice: harvests[1]!.pricePerUnit,
              totalPrice: 500 * harvests[1]!.pricePerUnit,
              status: OrderLineStatus.CONFIRMED,
            });
            await orderLineRepo.save(line2);
          }

          this.logger.log('Order and order lines seeded successfully.');
        }
      }
    }

    // =========================================================================
    // 7. Seed Logistics — Driver Profiles
    // =========================================================================
    const driverProfileRepo =
      this.userRepository.manager.getRepository(DriverProfileEntity);
    const driverProfileCount = await driverProfileRepo.count();
    let seededDriverUsers: UserEntity[] = [];

    if (driverProfileCount === 0) {
      this.logger.log('Seeding drivers...');

      const driverRole = await this.roleRepository.findOne({
        where: { name: 'Driver' },
      });
      if (!driverRole) {
        this.logger.warn('Driver role not found, skipping driver seed');
      } else {
        const driverEntries = [
          {
            email: 'moussa.diallo@futurefarm.local',
            firstName: 'Moussa',
            lastName: 'Diallo',
            licenseNumber: 'DK-2024-001',
            licenseCategory: 'B',
            licenseExpiresAt: '2026-12-31',
            isAvailable: true,
            averageRating: 4.5,
            totalDeliveriesCompleted: 87,
          },
          {
            email: 'fatoumata.ba@futurefarm.local',
            firstName: 'Fatoumata',
            lastName: 'Ba',
            licenseNumber: 'DK-2024-002',
            licenseCategory: 'C',
            licenseExpiresAt: '2025-06-30',
            isAvailable: true,
            averageRating: 4.8,
            totalDeliveriesCompleted: 134,
          },
          {
            email: 'ibrahima.ndiaye@futurefarm.local',
            firstName: 'Ibrahima',
            lastName: 'Ndiaye',
            licenseNumber: 'TH-2024-003',
            licenseCategory: 'B',
            licenseExpiresAt: '2027-03-15',
            isAvailable: true,
            averageRating: 4.2,
            totalDeliveriesCompleted: 56,
          },
          {
            email: 'aminata.sow@futurefarm.local',
            firstName: 'Aminata',
            lastName: 'Sow',
            licenseNumber: 'DK-2024-004',
            licenseCategory: 'C',
            licenseExpiresAt: '2026-09-30',
            isAvailable: false,
            averageRating: 4.6,
            totalDeliveriesCompleted: 203,
          },
          {
            email: 'cheikh.fall@futurefarm.local',
            firstName: 'Cheikh',
            lastName: 'Fall',
            licenseNumber: 'SL-2024-005',
            licenseCategory: 'B',
            licenseExpiresAt: '2025-11-30',
            isAvailable: true,
            averageRating: 4.0,
            totalDeliveriesCompleted: 42,
          },
        ];

        for (const entry of driverEntries) {
          const user = this.userRepository.create({
            email: entry.email,
            password: 'password',
            firstName: entry.firstName,
            lastName: entry.lastName,
            roles: [driverRole],
            isActive: true,
            status: UserStatus.APPROVED,
          });
          await this.userRepository.save(user);

          const profile = driverProfileRepo.create({
            userId: user.id,
            licenseNumber: entry.licenseNumber,
            licenseCategory: entry.licenseCategory,
            licenseExpiresAt: entry.licenseExpiresAt,
            isAvailable: entry.isAvailable,
            averageRating: entry.averageRating,
            totalDeliveriesCompleted: entry.totalDeliveriesCompleted,
          });
          await driverProfileRepo.save(profile);
          seededDriverUsers.push(user);
        }
        this.logger.log(`Seeded ${driverEntries.length} driver profiles.`);
      }
    } else {
      // Load existing drivers
      const driverRole = await this.roleRepository.findOne({
        where: { name: 'Driver' },
      });
      if (driverRole) {
        seededDriverUsers = await this.userRepository.find({
          where: { roles: { id: driverRole.id } },
        });
      }
    }

    // =========================================================================
    // 8. Seed Logistics — Vehicles
    // =========================================================================
    const vehicleRepo = this.userRepository.manager.getRepository(VehicleEntity);
    const vehicleCount = await vehicleRepo.count();

    if (vehicleCount === 0) {
      this.logger.log('Seeding vehicles...');

      if (seededDriverUsers.length < 5) {
        this.logger.warn(
          'Not enough drivers for vehicles, skipping vehicle seed',
        );
      } else {
        const vehicleEntries = [
          {
            registrationPlate: 'DK-001-A',
            type: VehicleType.TRUCK,
            capacityKg: 5000,
            capacityM3: 15,
            isActive: true,
            currentDriverId: seededDriverUsers[0]!.id,
          },
          {
            registrationPlate: 'DK-002-B',
            type: VehicleType.VAN,
            capacityKg: 1500,
            capacityM3: 8,
            isActive: true,
            currentDriverId: seededDriverUsers[1]!.id,
          },
          {
            registrationPlate: 'TH-003-C',
            type: VehicleType.TRUCK,
            capacityKg: 4000,
            capacityM3: 12,
            isActive: true,
            currentDriverId: seededDriverUsers[2]!.id,
          },
          {
            registrationPlate: 'DK-004-D',
            type: VehicleType.UTILITY,
            capacityKg: 800,
            capacityM3: 4,
            isActive: true,
            currentDriverId: seededDriverUsers[3]!.id,
          },
          {
            registrationPlate: 'DK-005-E',
            type: VehicleType.MOTORCYCLE,
            capacityKg: 200,
            capacityM3: 1,
            isActive: true,
            currentDriverId: seededDriverUsers[4]!.id,
          },
        ];

        for (const v of vehicleEntries) {
          await vehicleRepo.save(vehicleRepo.create(v));
        }
        this.logger.log(`Seeded ${vehicleEntries.length} vehicles.`);
      }
    }

    // =========================================================================
    // 9. Seed Logistics — Delivery Runs & Stops
    // =========================================================================
    const deliveryRunRepo =
      this.userRepository.manager.getRepository(DeliveryRunEntity);
    const deliveryRunCount = await deliveryRunRepo.count();

    if (deliveryRunCount === 0) {
      this.logger.log('Seeding delivery runs...');

      const orderLineRepo =
        this.userRepository.manager.getRepository(OrderLineEntity);
      const orderLines = await orderLineRepo.find();
      const vehicles = await vehicleRepo.find();

      if (orderLines.length < 1 || vehicles.length < 1) {
        this.logger.warn(
          'Order lines or vehicles missing, skipping delivery run seed',
        );
      } else {
        // Helper to build a stop address
        const dakarAddress = (street: string) => ({
          street,
          city: 'Dakar',
          lat: 14.7167,
          lon: -17.4677,
        });
        const runsData = [
          {
            // Active run 1 — Dakar city deliveries
            driverId: seededDriverUsers[0]?.id ?? null,
            vehicleId: vehicles[0]?.id ?? null,
            status: DeliveryRunStatus.IN_PROGRESS,
            scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
            startedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
            completedAt: null,
            totalDistanceKm: 35.5,
            notes: 'Tournée centre-ville Dakar',
            stops: [
              {
                orderLineId: orderLines[0]!.id,
                type: DeliveryStopType.COLLECTION,
                sequence: 1,
                status: DeliveryStopStatus.COMPLETED,
                address: dakarAddress('Marché Sandaga, Dakar-Plateau'),
                arrivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
                completedAt: new Date(Date.now() - 0.8 * 60 * 60 * 1000),
              },
            ],
          },
          {
            // Active run 2 — Thiès run
            driverId: seededDriverUsers[1]?.id ?? null,
            vehicleId: vehicles[1]?.id ?? null,
            status: DeliveryRunStatus.IN_PROGRESS,
            scheduledAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 0.5 * 60 * 60 * 1000),
            completedAt: null,
            totalDistanceKm: 72.0,
            notes: 'Livraison Thiès via autoroute',
            stops: [
              {
                orderLineId: orderLines[0]!.id,
                type: DeliveryStopType.COLLECTION,
                sequence: 1,
                status: DeliveryStopStatus.PENDING,
                address: dakarAddress('Zone Industrielle, Hann'),
              },
            ],
          },
          {
            // Completed run
            driverId: seededDriverUsers[2]?.id ?? null,
            vehicleId: vehicles[2]?.id ?? null,
            status: DeliveryRunStatus.COMPLETED,
            scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 47.5 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
            totalDistanceKm: 120.0,
            notes: 'Livraison Thiès complétée',
            stops: [
              {
                orderLineId: orderLines[0]!.id,
                type: DeliveryStopType.COLLECTION,
                sequence: 1,
                status: DeliveryStopStatus.COMPLETED,
                address: dakarAddress('Point E, Sicap'),
                arrivedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
                completedAt: new Date(Date.now() - 46.8 * 60 * 60 * 1000),
              },
            ],
          },
        ];

        for (const runData of runsData) {
          const { stops: stopsData, ...runFields } = runData;
          const run = deliveryRunRepo.create(runFields);
          await deliveryRunRepo.save(run);

          // Create stops for this run
          const stopRepo =
            this.userRepository.manager.getRepository(DeliveryStopEntity);
          for (const stopData of stopsData) {
            await stopRepo.save(
              stopRepo.create({
                ...stopData,
                runId: run.id,
              }),
            );
          }
        }
        this.logger.log(`Seeded ${runsData.length} delivery runs.`);
      }
    }

    // =========================================================================
    // 10. Seed Inspections — Centers
    // =========================================================================
    const centerRepo =
      this.userRepository.manager.getRepository(InspectionCenterEntity);
    const centerCount = await centerRepo.count();

    if (centerCount === 0) {
      this.logger.log('Seeding inspection centers...');

      const centersData = [
        {
          name: "Centre d'Inspection de Dakar-Plateau",
          code: 'DK-PLT-001',
          regionName: 'Dakar',
          address: '12 Avenue Léopold Sédar Senghor, Dakar',
          latitude: 14.6937,
          longitude: -17.4441,
          isActive: true,
        },
        {
          name: "Centre d'Inspection de Thiès",
          code: 'TH-CEN-001',
          regionName: 'Thiès',
          address: 'Rue de la Gare, Thiès',
          latitude: 14.791,
          longitude: -16.926,
          isActive: true,
        },
        {
          name: "Centre d'Inspection de Saint-Louis",
          code: 'SL-NOR-001',
          regionName: 'Saint-Louis',
          address: '25 Quai Roume, Saint-Louis',
          latitude: 16.0249,
          longitude: -16.5043,
          isActive: true,
        },
      ];

      for (const c of centersData) {
        await centerRepo.save(centerRepo.create(c));
      }
      this.logger.log(`Seeded ${centersData.length} inspection centers.`);
    }

    // =========================================================================
    // 11. Seed Inspections — Inspector Profiles
    // =========================================================================
    const inspectorProfileRepo =
      this.userRepository.manager.getRepository(InspectorProfileEntity);
    const inspectorProfileCount = await inspectorProfileRepo.count();
    let seededInspectorProfiles: InspectorProfileEntity[] = [];

    if (inspectorProfileCount === 0) {
      this.logger.log('Seeding inspector profiles...');

      const inspectorRole = await this.roleRepository.findOne({
        where: { name: 'Inspector' },
      });
      if (!inspectorRole) {
        this.logger.warn('Inspector role not found, skipping inspector seed');
      } else {
        const inspectorEntries = [
          {
            email: 'ousmane.diop@futurefarm.local',
            firstName: 'Ousmane',
            lastName: 'Diop',
            licenseNumber: 'INS-DK-2023-001',
            agencyName: 'Agence Nationale de Contrôle Qualité',
            specializations: ['CEREALS', 'FRUITS'],
          },
          {
            email: 'ndeye.gueye@futurefarm.local',
            firstName: 'Ndeye',
            lastName: 'Gueye',
            licenseNumber: 'INS-DK-2023-002',
            agencyName: 'Ministère de l\'Agriculture',
            specializations: ['VEGETABLES', 'DATES'],
          },
          {
            email: 'mamadou.faye@futurefarm.local',
            firstName: 'Mamadou',
            lastName: 'Faye',
            licenseNumber: 'INS-TH-2023-003',
            agencyName: 'Direction Régionale de l\'Agriculture Thiès',
            specializations: ['CEREALS', 'VEGETABLES', 'DAIRY'],
          },
          {
            email: 'astou.ndao@futurefarm.local',
            firstName: 'Astou',
            lastName: 'Ndao',
            licenseNumber: 'INS-SL-2023-004',
            agencyName: 'Agence Nationale de Contrôle Qualité',
            specializations: ['FRUITS', 'DATES'],
          },
          {
            email: 'papa.diouf@futurefarm.local',
            firstName: 'Papa',
            lastName: 'Diouf',
            licenseNumber: 'INS-DK-2023-005',
            agencyName: 'Laboratoire National d\'Analyses',
            specializations: ['DAIRY', 'MEAT', 'OTHER'],
          },
        ];

        for (const entry of inspectorEntries) {
          const user = this.userRepository.create({
            email: entry.email,
            password: 'password',
            firstName: entry.firstName,
            lastName: entry.lastName,
            roles: [inspectorRole],
            isActive: true,
            status: UserStatus.APPROVED,
          });
          await this.userRepository.save(user);

          const profile = inspectorProfileRepo.create({
            userId: user.id,
            licenseNumber: entry.licenseNumber,
            agencyName: entry.agencyName,
            specializations: entry.specializations,
            isActiveInspector: true,
          });
          const saved = await inspectorProfileRepo.save(profile);
          seededInspectorProfiles.push(saved);
        }
        this.logger.log(
          `Seeded ${inspectorEntries.length} inspector profiles.`,
        );
      }
    } else {
      seededInspectorProfiles = await inspectorProfileRepo.find();
    }

    // =========================================================================
    // 12. Seed Inspections — Center Assignments
    // =========================================================================
    const assignmentRepo =
      this.userRepository.manager.getRepository(
        InspectorCenterAssignmentEntity,
      );
    const assignmentCount = await assignmentRepo.count();

    if (assignmentCount === 0) {
      const centers = await centerRepo.find();
      if (centers.length > 0 && seededInspectorProfiles.length > 0) {
        this.logger.log('Seeding inspector-center assignments...');
        for (let i = 0; i < seededInspectorProfiles.length; i++) {
          // Assign to a center in round-robin fashion
          const center = centers[i % centers.length];
          await assignmentRepo.save(
            assignmentRepo.create({
              inspectorProfileId: seededInspectorProfiles[i]!.id,
              inspectionCenterId: center!.id,
              isCurrentAssignment: true,
            }),
          );
        }
        this.logger.log('Inspector-center assignments seeded.');
      }
    }

    // =========================================================================
    // 13. Seed Inspections — Reports & Photos
    // =========================================================================
    const reportRepo =
      this.userRepository.manager.getRepository(InspectionReportEntity);
    const reportCount = await reportRepo.count();

    if (reportCount === 0) {
      this.logger.log('Seeding inspection reports...');

      const harvestRepo =
        this.userRepository.manager.getRepository(HarvestEntity);
      const harvests = await harvestRepo.find();

      if (harvests.length < 1 || seededInspectorProfiles.length < 1) {
        this.logger.warn(
          'Harvests or inspectors missing, skipping report seed',
        );
      } else {
        const checklistPassAll = {
          VISUAL_QUALITY: { passed: true, notes: 'Aspect visuel satisfaisant' },
          MICROBIAL_COUNT: {
            passed: true,
            notes: 'Comptage microbien dans les normes',
          },
          WEIGHT_CALIBRATION: {
            passed: true,
            notes: 'Calibration conforme aux standards',
          },
          PACKAGING: {
            passed: true,
            notes: 'Emballage intact et conforme',
          },
          LABELING: {
            passed: true,
            notes: 'Étiquetage réglementaire présent',
          },
        };
        const checklistMinorIssues = {
          VISUAL_QUALITY: { passed: true, notes: 'Léger défaut esthétique mineur' },
          MICROBIAL_COUNT: {
            passed: true,
            notes: 'Comptage acceptable',
          },
          WEIGHT_CALIBRATION: {
            passed: true,
            notes: 'Calibration conforme',
          },
          PACKAGING: {
            passed: false,
            notes: 'Emballage légèrement endommagé sur 5% du lot',
          },
          LABELING: {
            passed: true,
            notes: 'Étiquetage conforme',
          },
        };
        const checklistFailedWeight = {
          VISUAL_QUALITY: { passed: true, notes: 'Produits de bonne qualité visuelle' },
          MICROBIAL_COUNT: {
            passed: true,
            notes: 'Dans les limites acceptables',
          },
          WEIGHT_CALIBRATION: {
            passed: false,
            notes: 'Écart de poids constaté: -3.2% sur l\'échantillon',
          },
          PACKAGING: {
            passed: true,
            notes: 'Emballage conforme',
          },
          LABELING: {
            passed: true,
            notes: 'Étiquetage présent et lisible',
          },
        };

        const reportsData = [
          {
            harvestId: harvests[0]!.id,
            inspectorProfileId: seededInspectorProfiles[0]!.id,
            status: InspectionStatus.SUBMITTED,
            checklist: checklistPassAll,
            overallNotes: 'Lot conforme aux normes de qualité. Aucune non-conformité détectée.',
            siteVisitDate: new Date('2025-06-20'),
            aiPreScreenScore: 92.5,
            aiPreScreenNotes: 'Analyse IA: produit bien formé, couleur uniforme.',
            finalQualityScore: 4.5,
            submittedAt: new Date('2025-06-20T16:30:00'),
            photos: [
              {
                url: 'https://storage.futurefarm.sn/inspections/dakar-001-photo-1.jpg',
                size: 2048576,
                takenAt: new Date('2025-06-20T10:15:00'),
                latitude: 14.6937,
                longitude: -17.4441,
              },
              {
                url: 'https://storage.futurefarm.sn/inspections/dakar-001-photo-2.jpg',
                size: 1512345,
                takenAt: new Date('2025-06-20T10:20:00'),
                latitude: 14.6937,
                longitude: -17.4441,
              },
            ],
          },
          {
            harvestId: harvests[0]!.id,
            inspectorProfileId: seededInspectorProfiles[1]!.id,
            status: InspectionStatus.IN_PROGRESS,
            checklist: checklistMinorIssues,
            overallNotes: 'Quelques défauts d\'emballage mineurs à corriger.',
            siteVisitDate: new Date('2025-07-05'),
            aiPreScreenScore: 78.0,
            aiPreScreenNotes: 'IA signale un léger écart de calibre sur 8% du lot.',
            finalQualityScore: null,
            submittedAt: null,
            photos: [
              {
                url: 'https://storage.futurefarm.sn/inspections/thies-001-photo-1.jpg',
                size: 987654,
                takenAt: new Date('2025-07-05T09:00:00'),
                latitude: 14.791,
                longitude: -16.926,
              },
            ],
          },
          {
            harvestId: harvests.length > 1 ? harvests[1]!.id : harvests[0]!.id,
            inspectorProfileId: seededInspectorProfiles[2]!.id,
            status: InspectionStatus.SUBMITTED,
            checklist: checklistFailedWeight,
            overallNotes: 'Non-conformité sur le poids. Un ré-échantillonnage est recommandé.',
            siteVisitDate: new Date('2025-07-10'),
            aiPreScreenScore: 65.3,
            aiPreScreenNotes: 'Variabilité de taille détectée par analyse IA.',
            finalQualityScore: 3.2,
            submittedAt: new Date('2025-07-10T14:00:00'),
            photos: [
              {
                url: 'https://storage.futurefarm.sn/inspections/thies-002-photo-1.jpg',
                size: 1823456,
                takenAt: new Date('2025-07-10T08:30:00'),
                latitude: 14.791,
                longitude: -16.926,
              },
              {
                url: 'https://storage.futurefarm.sn/inspections/thies-002-photo-2.jpg',
                size: 1345678,
                takenAt: new Date('2025-07-10T08:35:00'),
                latitude: 14.791,
                longitude: -16.926,
              },
              {
                url: 'https://storage.futurefarm.sn/inspections/thies-002-photo-3.jpg',
                size: 2123456,
                takenAt: new Date('2025-07-10T08:40:00'),
                latitude: 14.791,
                longitude: -16.926,
              },
            ],
          },
          {
            harvestId: harvests.length > 1 ? harvests[1]!.id : harvests[0]!.id,
            inspectorProfileId: seededInspectorProfiles[3]!.id,
            status: InspectionStatus.SUBMITTED,
            checklist: checklistPassAll,
            overallNotes: 'Produit de très bonne qualité. Certification recommandée.',
            siteVisitDate: new Date('2025-07-12'),
            aiPreScreenScore: 95.0,
            aiPreScreenNotes: 'Excellente qualité homogène confirmée par IA.',
            finalQualityScore: 4.9,
            submittedAt: new Date('2025-07-12T11:45:00'),
            photos: [],
          },
          {
            harvestId: harvests[0]!.id,
            inspectorProfileId: seededInspectorProfiles[4]!.id,
            status: InspectionStatus.REJECTED,
            checklist: {
              VISUAL_QUALITY: { passed: false, notes: 'Produits présentant des moisissures visibles' },
              MICROBIAL_COUNT: { passed: false, notes: 'Taux microbien dépassant le seuil réglementaire' },
              WEIGHT_CALIBRATION: { passed: true, notes: 'Calibration correcte' },
              PACKAGING: { passed: false, notes: 'Emballages non conformes à la norme' },
              LABELING: { passed: false, notes: 'Absence de date de péremption sur 30% des unités' },
            },
            overallNotes: 'Lot rejeté pour causes multiples: contamination microbienne, défauts d\'emballage et étiquetage incomplet.',
            siteVisitDate: new Date('2025-07-15'),
            aiPreScreenScore: 35.0,
            aiPreScreenNotes: 'Risque élevé détecté: moisissure probable sur 40% des échantillons.',
            finalQualityScore: 1.5,
            submittedAt: new Date('2025-07-15T17:00:00'),
            photos: [
              {
                url: 'https://storage.futurefarm.sn/inspections/saint-louis-001-photo-1.jpg',
                size: 2456789,
                takenAt: new Date('2025-07-15T13:00:00'),
                latitude: 16.0249,
                longitude: -16.5043,
              },
            ],
          },
        ];

        const photoRepo =
          this.userRepository.manager.getRepository(InspectionPhotoEntity);
        for (const rData of reportsData) {
          const { photos: photosData, ...reportFields } = rData;
          const report = reportRepo.create(reportFields);
          await reportRepo.save(report);

          for (const pData of photosData) {
            await photoRepo.save(
              photoRepo.create({
                ...pData,
                inspectionReportId: report.id,
              }),
            );
          }
        }
        this.logger.log(`Seeded ${reportsData.length} inspection reports.`);
      }
    }

    // =========================================================================
    // 14. Seed Auctions
    // =========================================================================
    const auctionRepo =
      this.userRepository.manager.getRepository(AuctionEntity);
    const auctionCount = await auctionRepo.count();

    if (auctionCount === 0) {
      this.logger.log('Seeding auctions...');

      const harvestRepo =
        this.userRepository.manager.getRepository(HarvestEntity);
      const harvests = await harvestRepo.find();

      if (harvests.length < 1 || !seededFarmerProfile) {
        this.logger.warn('Harvests or farmer profile missing, skipping auction seed');
      } else {
        const now = new Date();

        const auctionsData = [
          {
            // Active auction — started 6 hours ago, ends in 18 hours
            harvestId: harvests[0]!.id,
            farmerProfileId: seededFarmerProfile.id,
            status: AuctionStatus.ACTIVE,
            startingPrice: 300,
            reservePrice: 200,
            currentPrice: 280,
            priceDecrementAmount: 10,
            priceDecrementIntervalMinutes: 30,
            nextDecrementAt: new Date(now.getTime() + 15 * 60 * 1000),
            quantityOnOffer: 500,
            startAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
            endAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
          },
          {
            // Upcoming auction — starts in 2 days
            harvestId: harvests.length > 1 ? harvests[1]!.id : harvests[0]!.id,
            farmerProfileId: seededFarmerProfile.id,
            status: AuctionStatus.SCHEDULED,
            startingPrice: 180,
            reservePrice: 120,
            currentPrice: 180,
            priceDecrementAmount: 5,
            priceDecrementIntervalMinutes: 20,
            nextDecrementAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            quantityOnOffer: 300,
            startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            endAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
          },
          {
            // Ended / expired auction
            harvestId: harvests[0]!.id,
            farmerProfileId: seededFarmerProfile.id,
            status: AuctionStatus.EXPIRED,
            startingPrice: 350,
            reservePrice: 250,
            currentPrice: 250,
            priceDecrementAmount: 10,
            priceDecrementIntervalMinutes: 30,
            nextDecrementAt: new Date('2025-06-01T00:00:00Z'),
            quantityOnOffer: 200,
            startAt: new Date('2025-05-25T08:00:00Z'),
            endAt: new Date('2025-05-31T18:00:00Z'),
          },
        ];

        for (const a of auctionsData) {
          await auctionRepo.save(auctionRepo.create(a));
        }
        this.logger.log(`Seeded ${auctionsData.length} auctions.`);
      }
    }

    this.logger.log('Database seeding complete.');
  }
}
