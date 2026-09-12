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
  ParcelStatus,
  FeeCalculationType,
  AddressType,
  AddressableType,
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
import { ParcelEntity } from '../modules/users/entities/parcel.entity';
import { OrderEntity } from '../modules/orders/entities/order.entity';
import { OrderLineEntity } from '../modules/orders/entities/order-line.entity';
import { PlatformFeeEntity } from '../modules/fees/entities/platform-fee.entity';
import { AddressEntity } from '../modules/addresses/entities/address.entity';

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
    this.logger.log('Ensuring default product crop templates...');
    const defaultProducts = [
      { name: 'Soja', description: 'Graines de soja locales de qualité supérieure, riches en protéines et adaptées à la transformation.', category: ProductCategory.CEREALS },
      { name: 'Maïs', description: 'Épis de maïs doux frais et dorés, récoltés à point pour une saveur sucrée optimale.', category: ProductCategory.CEREALS },
      {
        name: 'Tomates',
        description:
          "Nos tomates grappes Bio sont cultivées selon des méthodes traditionnelles respectueuses de l'environnement au cœur de la vallée. Récoltées à pleine maturité, elles offrent un goût sucré et une texture ferme idéale pour vos étals. Aucun pesticide de synthèse utilisé, traitement naturel uniquement.",
        category: ProductCategory.VEGETABLES,
      },
      { name: 'Dattes Medjool', description: 'Dattes Medjool de qualité premium séchées naturellement sous le soleil saharien.', category: ProductCategory.DATES },
      { name: 'Pommes', description: 'Pommes rouges croquantes et juteuses, sélectionnées pour leur haute teneur en vitamines.', category: ProductCategory.FRUITS },
      { name: 'Lait Frais', description: 'Lait entier pasteurisé de ferme, issu de vaches nourries en pâturage naturel.', category: ProductCategory.DAIRY },
      { name: 'Pommes de Terre', description: 'Pommes de terre fraîches pour cuisson et purée, chair ferme de premier choix.', category: ProductCategory.VEGETABLES },
      { name: 'Carottes', description: 'Carottes bio riches en carotène, cultivées en sol sableux léger pour une douceur exceptionnelle.', category: ProductCategory.VEGETABLES },
      { name: 'Oignons', description: 'Oignons jaunes de garde, séchés sous abri pour une excellente conservation.', category: ProductCategory.VEGETABLES },
      { name: 'Mangues', description: 'Mangues Kent sucrées et parfumées, cueillies à maturité optimale sur l’arbre.', category: ProductCategory.FRUITS },
    ];
    for (const prod of defaultProducts) {
      const existing = await productRepository.findOne({ where: { name: prod.name } });
      if (!existing) {
        await productRepository.save(productRepository.create(prod));
      } else if (existing.description !== prod.description) {
        existing.description = prod.description;
        await productRepository.save(existing);
      }
    }
    this.logger.log('Default product templates verified.');

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
    const harvestRepository = this.userRepository.manager.getRepository(HarvestEntity);
    let seededFarmerProfile: FarmerProfileEntity | null = null;

    const farmerRole = await this.roleRepository.findOne({
      where: { name: 'Farmer' },
    });

    if (farmerRole) {
      const farmerDefinitions = [
        {
          email: 'amadou.toure@futurefarm.local',
          firstName: 'Amadou',
          lastName: 'Touré',
          companyName: 'Ferme Bio de Rufisque',
          address: 'Route de Rufisque, Dakar',
          isCertified: true,
          bio: 'Producteur certifié de céréales et légumes biologiques avec irrigation solaire durable.',
        },
        {
          email: 'fatou.ndiaye@futurefarm.local',
          firstName: 'Fatou',
          lastName: 'Ndiaye',
          companyName: 'Vergers du Fleuve',
          address: 'Vallée du Fleuve, Saint-Louis',
          isCertified: true,
          bio: 'Spécialiste de la culture fruitière et de dattes Medjool haut de gamme.',
        },
        {
          email: 'moussa.sow@futurefarm.local',
          firstName: 'Moussa',
          lastName: 'Sow',
          companyName: 'Coopérative Maraîchère de Thiès',
          address: 'Zone Agricole, Thiès',
          isCertified: true,
          bio: 'Coopérative familiale de maraîchage, tubercules et produits laitiers frais du jour.',
        },
      ];

      const farmerProfiles: FarmerProfileEntity[] = [];

      for (const fDef of farmerDefinitions) {
        let farmerUser = await this.userRepository.findOne({
          where: { email: fDef.email },
        });

        if (!farmerUser) {
          farmerUser = this.userRepository.create({
            email: fDef.email,
            password: 'password',
            firstName: fDef.firstName,
            lastName: fDef.lastName,
            roles: [farmerRole],
            isActive: true,
            status: UserStatus.APPROVED,
          });
          await this.userRepository.save(farmerUser);
        }

        let fProfile = await farmerProfileRepo.findOne({
          where: { userId: farmerUser.id },
        });

        if (!fProfile) {
          fProfile = farmerProfileRepo.create({
            userId: farmerUser.id,
            companyName: fDef.companyName,
            address: fDef.address,
            isCertified: fDef.isCertified,
            bio: fDef.bio,
          });
          fProfile = await farmerProfileRepo.save(fProfile);
        }

        farmerProfiles.push(fProfile);
      }

      seededFarmerProfile = farmerProfiles[0] || null;

      // Ensure parcels for traceability & distribution location
      const parcelRepo = this.userRepository.manager.getRepository(ParcelEntity);
      const parcels: ParcelEntity[] = [];
      const parcelDefs = [
        {
          farmerProfile: farmerProfiles[0],
          cadastralNumber: 'DKR-2024-PARC-04',
          sizeHectares: 12.5,
          locationCoordinates: 'Silo Nord - Plateforme de Distribution 4',
          cropTypes: ['Tomates', 'Maïs', 'Soja'],
          status: ParcelStatus.VERIFIED,
        },
        {
          farmerProfile: farmerProfiles[1] || farmerProfiles[0],
          cadastralNumber: 'THS-2024-PARC-09',
          sizeHectares: 8.0,
          locationCoordinates: 'Coopérative Maraîchère de Thiès - Hub Ouest',
          cropTypes: ['Tomates', 'Carottes', 'Pommes'],
          status: ParcelStatus.VERIFIED,
        },
        {
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          cadastralNumber: 'STL-2024-PARC-18',
          sizeHectares: 15.0,
          locationCoordinates: 'Silo Sud - Centre Agro-Logistique Saint-Louis',
          cropTypes: ['Tomates', 'Oignons', 'Pommes de Terre'],
          status: ParcelStatus.VERIFIED,
        },
      ];

      for (const pDef of parcelDefs) {
        if (!pDef.farmerProfile) continue;
        let parcel = await parcelRepo.findOne({
          where: { cadastralNumber: pDef.cadastralNumber },
        });
        if (!parcel) {
          parcel = parcelRepo.create({
            farmerProfileId: pDef.farmerProfile.id,
            cadastralNumber: pDef.cadastralNumber,
            sizeHectares: pDef.sizeHectares,
            locationCoordinates: pDef.locationCoordinates,
            cropTypes: pDef.cropTypes,
            status: pDef.status,
            verifiedAt: new Date(),
          });
          parcel = await parcelRepo.save(parcel);
        }
        parcels.push(parcel);
      }

      // Ensure comprehensive approved harvests catalogue
      this.logger.log('Ensuring enriched approved harvests catalogue...');
      const products = await productRepository.find();
      const findProd = (name: string) => products.find((p) => p.name.toLowerCase() === name.toLowerCase());

      const tomProd = findProd('Tomates');
      const pomProd = findProd('Pommes');
      const datProd = findProd('Dattes Medjool');
      const maiProd = findProd('Maïs');
      const sojProd = findProd('Soja');
      const pdtProd = findProd('Pommes de Terre');
      const carProd = findProd('Carottes');
      const manProd = findProd('Mangues');
      const laiProd = findProd('Lait Frais');
      const oigProd = findProd('Oignons');

      const now = new Date();
      const harvestBatchList = [
        // --- Tomates Grappes Bio (Batch 1: Active batch) ---
        {
          product: tomProd,
          farmerProfile: farmerProfiles[0],
          parcel: parcels[0],
          quantityInStock: 450,
          stockMarge: 50,
          pricePerUnit: 2400,
          unit: HarvestUnit.KG,
          farmingMethods: 'Agriculture Biologique, HVE',
          photoUrls: [
            'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800',
            'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800',
          ],
          qualityScore: 92,
          daysHarvestAgo: 7,
          daysFresh: 45,
        },
        // --- Tomates Grappes Bio (Batch 2: Older available batch) ---
        {
          product: tomProd,
          farmerProfile: farmerProfiles[1] || farmerProfiles[0],
          parcel: parcels[1] || parcels[0],
          quantityInStock: 320,
          stockMarge: 30,
          pricePerUnit: 2100,
          unit: HarvestUnit.KG,
          farmingMethods: 'Agriculture Biologique, HVE',
          photoUrls: [
            'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800',
            'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800',
          ],
          qualityScore: 89,
          daysHarvestAgo: 38,
          daysFresh: 25,
        },
        // --- Tomates Grappes Bio (Batch 3: Older depleted batch) ---
        {
          product: tomProd,
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          parcel: parcels[2] || parcels[0],
          quantityInStock: 0,
          stockMarge: 0,
          pricePerUnit: 1900,
          unit: HarvestUnit.KG,
          farmingMethods: 'Culture traditionnelle sans engrais chimiques',
          photoUrls: [
            'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800',
            'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800',
          ],
          qualityScore: 85,
          daysHarvestAgo: 68,
          daysFresh: -5,
        },
        {
          product: pomProd,
          farmerProfile: farmerProfiles[1] || farmerProfiles[0],
          parcel: parcels[1] || parcels[0],
          quantityInStock: 1800,
          stockMarge: 30,
          pricePerUnit: 3500,
          unit: HarvestUnit.KG,
          farmingMethods: 'Vergers éco-responsables, cueillette manuelle',
          photoUrls: [
            'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800',
            'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=800',
            'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=800',
          ],
          qualityScore: 91,
          daysHarvestAgo: 10,
          daysFresh: 60,
        },
        {
          product: datProd,
          farmerProfile: farmerProfiles[1] || farmerProfiles[0],
          parcel: parcels[1] || parcels[0],
          quantityInStock: 800,
          stockMarge: 20,
          pricePerUnit: 4800,
          unit: HarvestUnit.KG,
          farmingMethods: 'Séchage artisanal au soleil, sélection premium',
          photoUrls: [
            'https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=800',
            'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
            'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800',
          ],
          qualityScore: 98,
          daysHarvestAgo: 15,
          daysFresh: 180,
        },
        {
          product: maiProd,
          farmerProfile: farmerProfiles[0],
          parcel: parcels[0],
          quantityInStock: 3500,
          stockMarge: 80,
          pricePerUnit: 1800,
          unit: HarvestUnit.KG,
          farmingMethods: 'Culture traditionnelle sans OGM',
          photoUrls: [
            'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800',
            'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=800',
            'https://images.unsplash.com/photo-1568651316823-39716e257007?w=800',
          ],
          qualityScore: 88,
          daysHarvestAgo: 8,
          daysFresh: 90,
        },
        {
          product: pdtProd,
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          parcel: parcels[2] || parcels[0],
          quantityInStock: 4000,
          stockMarge: 100,
          pricePerUnit: 1600,
          unit: HarvestUnit.KG,
          farmingMethods: 'Culture de plein champ, calibre sélectionné',
          photoUrls: [
            'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800',
            'https://images.unsplash.com/photo-1508747703725-719777637510?w=800',
            'https://images.unsplash.com/photo-1590165482129-1b8b27698980?w=800',
          ],
          qualityScore: 86,
          daysHarvestAgo: 12,
          daysFresh: 75,
        },
        {
          product: carProd,
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          parcel: parcels[2] || parcels[0],
          quantityInStock: 1500,
          stockMarge: 40,
          pricePerUnit: 2200,
          unit: HarvestUnit.KG,
          farmingMethods: 'Permaculture, zéro résidu de pesticides',
          photoUrls: [
            'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800',
            'https://images.unsplash.com/photo-1447175008436-054170c2e979?w=800',
            'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800',
          ],
          qualityScore: 92,
          daysHarvestAgo: 5,
          daysFresh: 50,
        },
        {
          product: manProd,
          farmerProfile: farmerProfiles[1] || farmerProfiles[0],
          parcel: parcels[1] || parcels[0],
          quantityInStock: 1200,
          stockMarge: 25,
          pricePerUnit: 4200,
          unit: HarvestUnit.KG,
          farmingMethods: 'Cueillette à maturité optimale sur l’arbre',
          photoUrls: [
            'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800',
            'https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=800',
            'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800',
          ],
          qualityScore: 96,
          daysHarvestAgo: 4,
          daysFresh: 30,
        },
        {
          product: sojProd,
          farmerProfile: farmerProfiles[0],
          parcel: parcels[0],
          quantityInStock: 5000,
          stockMarge: 150,
          pricePerUnit: 2100,
          unit: HarvestUnit.KG,
          farmingMethods: 'Agriculture régénératrice, rotation des sols',
          photoUrls: [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
            'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=800',
            'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
          ],
          qualityScore: 89,
          daysHarvestAgo: 14,
          daysFresh: 120,
        },
        {
          product: laiProd,
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          parcel: parcels[2] || parcels[0],
          quantityInStock: 600,
          stockMarge: 10,
          pricePerUnit: 3000,
          unit: HarvestUnit.PIECE,
          farmingMethods: 'Élevage en plein air, pasteurisation douce',
          photoUrls: [
            'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800',
            'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=800',
            'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
          ],
          qualityScore: 95,
          daysHarvestAgo: 2,
          daysFresh: 20,
        },
        {
          product: oigProd,
          farmerProfile: farmerProfiles[2] || farmerProfiles[0],
          parcel: parcels[2] || parcels[0],
          quantityInStock: 2800,
          stockMarge: 60,
          pricePerUnit: 1900,
          unit: HarvestUnit.KG,
          farmingMethods: 'Séchage naturel sous abri ventilé',
          photoUrls: [
            'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=800',
            'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=800',
            'https://images.unsplash.com/photo-1508747703725-719777637510?w=800',
          ],
          qualityScore: 87,
          daysHarvestAgo: 11,
          daysFresh: 100,
        },
      ];

      for (const b of harvestBatchList) {
        if (!b.product || !b.farmerProfile) continue;

        const daysHarvestAgo = b.daysHarvestAgo ?? 7;
        const harvestDate = new Date(now.getTime() - daysHarvestAgo * 24 * 60 * 60 * 1000);
        const expirationDate = new Date(now.getTime() + b.daysFresh * 24 * 60 * 60 * 1000);

        const existing = await harvestRepository.findOne({
          where: {
            productId: b.product.id,
            farmerProfileId: b.farmerProfile.id,
            pricePerUnit: b.pricePerUnit,
          },
        });

        if (!existing) {
          const harvestEntity = harvestRepository.create({
            productId: b.product.id,
            farmerProfileId: b.farmerProfile.id,
            parcelId: b.parcel?.id ?? null,
            harvestDate,
            expirationDate,
            quantityInStock: b.quantityInStock,
            stockMarge: b.stockMarge,
            pricePerUnit: b.pricePerUnit,
            currency: 'CDF',
            exchangeRate: 2300.0,
            pricePerUnitUSD: Number((b.pricePerUnit / 2300.0).toFixed(2)),
            unit: b.unit,
            farmingMethods: b.farmingMethods,
            photoUrls: b.photoUrls,
            status: HarvestStatus.APPROVED,
            qualityScore: b.qualityScore,
          });
          await harvestRepository.save(harvestEntity);
        } else {
          // Refresh existing harvest to ensure valid parcel, future expiration date, approved status, and photos
          let modified = false;
          if (existing.status !== HarvestStatus.APPROVED) {
            existing.status = HarvestStatus.APPROVED;
            modified = true;
          }
          if (b.parcel && existing.parcelId !== b.parcel.id) {
            existing.parcelId = b.parcel.id;
            modified = true;
          }
          if (existing.farmingMethods !== b.farmingMethods) {
            existing.farmingMethods = b.farmingMethods;
            modified = true;
          }
          if (new Date(existing.expirationDate).getTime() < now.getTime() && b.daysFresh > 0) {
            existing.expirationDate = expirationDate;
            existing.harvestDate = harvestDate;
            modified = true;
          }
          if (!existing.photoUrls || existing.photoUrls.length < 3) {
            existing.photoUrls = b.photoUrls;
            modified = true;
          }
          if (Number(existing.qualityScore) !== b.qualityScore) {
            existing.qualityScore = b.qualityScore;
            modified = true;
          }
          if (Number(existing.quantityInStock) !== b.quantityInStock) {
            existing.quantityInStock = b.quantityInStock;
            modified = true;
          }
          if (existing.currency !== 'CDF' || Number(existing.exchangeRate) !== 2300.0 || !existing.pricePerUnitUSD) {
            existing.currency = 'CDF';
            existing.exchangeRate = 2300.0;
            existing.pricePerUnitUSD = Number((Number(existing.pricePerUnit) / 2300.0).toFixed(2));
            modified = true;
          }
          if (modified) {
            await harvestRepository.save(existing);
          }
        }
      }

      // Ensure all harvests in the database are set to CDF currency with correct USD conversions
      const allHarvestsInDb = await harvestRepository.find();
      for (const h of allHarvestsInDb) {
        if (h.currency !== 'CDF' || Number(h.exchangeRate) !== 2300.0 || !h.pricePerUnitUSD) {
          h.currency = 'CDF';
          h.exchangeRate = 2300.0;
          h.pricePerUnitUSD = Number((Number(h.pricePerUnit) / 2300.0).toFixed(2));
          await harvestRepository.save(h);
        }
      }

      this.logger.log('Enriched approved harvests catalogue verified successfully.');
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
    const harvestRepo =
      this.userRepository.manager.getRepository(HarvestEntity);

    const allHarvests = await harvestRepo.find({ relations: { product: true, farmerProfile: true } });

    if (allHarvests.length > 0) {
      this.logger.log('Ensuring enriched auctions catalogue...');
      const now = new Date();

      const tomH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('tomate')) || allHarvests[0];
      const maiH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('maïs')) || allHarvests[1] || allHarvests[0];
      const carH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('carotte')) || allHarvests[2] || allHarvests[0];
      const manH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('mangue')) || allHarvests[3] || allHarvests[0];
      const datH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('datte')) || allHarvests[4] || allHarvests[0];
      const pdtH = allHarvests.find((h) => h.product?.name?.toLowerCase().includes('pommes de terre')) || allHarvests[5] || allHarvests[0];

      const auctionDefinitions = [
        {
          // Active auction 1 — Tomates Bio (live decreasing price)
          harvest: tomH,
          farmerProfileId: tomH!.farmerProfileId,
          status: AuctionStatus.ACTIVE,
          startingPrice: 3000,
          reservePrice: 2000,
          currentPrice: 2400,
          priceDecrementAmount: 50,
          priceDecrementIntervalMinutes: 30,
          nextDecrementAt: new Date(now.getTime() + 15 * 60 * 1000),
          quantityOnOffer: 600,
          startAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
        {
          // Active auction 2 — Maïs Doux (live decreasing price)
          harvest: maiH,
          farmerProfileId: maiH!.farmerProfileId,
          status: AuctionStatus.ACTIVE,
          startingPrice: 2200,
          reservePrice: 1500,
          currentPrice: 1800,
          priceDecrementAmount: 40,
          priceDecrementIntervalMinutes: 45,
          nextDecrementAt: new Date(now.getTime() + 25 * 60 * 1000),
          quantityOnOffer: 1200,
          startAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
        },
        {
          // Active auction 3 — Carottes Bio (live decreasing price)
          harvest: carH,
          farmerProfileId: carH!.farmerProfileId,
          status: AuctionStatus.ACTIVE,
          startingPrice: 2800,
          reservePrice: 1900,
          currentPrice: 2200,
          priceDecrementAmount: 60,
          priceDecrementIntervalMinutes: 30,
          nextDecrementAt: new Date(now.getTime() + 10 * 60 * 1000),
          quantityOnOffer: 500,
          startAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 36 * 60 * 60 * 1000),
        },
        {
          // Scheduled auction 1 — Mangues Kent (starts in 2 days)
          harvest: manH,
          farmerProfileId: manH!.farmerProfileId,
          status: AuctionStatus.SCHEDULED,
          startingPrice: 4800,
          reservePrice: 3500,
          currentPrice: 4800,
          priceDecrementAmount: 100,
          priceDecrementIntervalMinutes: 60,
          nextDecrementAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          quantityOnOffer: 400,
          startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
        {
          // Scheduled auction 2 — Dattes Medjool (starts in 1 day)
          harvest: datH,
          farmerProfileId: datH!.farmerProfileId,
          status: AuctionStatus.SCHEDULED,
          startingPrice: 5500,
          reservePrice: 4200,
          currentPrice: 5500,
          priceDecrementAmount: 150,
          priceDecrementIntervalMinutes: 60,
          nextDecrementAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          quantityOnOffer: 300,
          startAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          // Expired auction — Pommes de Terre
          harvest: pdtH,
          farmerProfileId: pdtH!.farmerProfileId,
          status: AuctionStatus.EXPIRED,
          startingPrice: 2000,
          reservePrice: 1400,
          currentPrice: 1400,
          priceDecrementAmount: 50,
          priceDecrementIntervalMinutes: 30,
          nextDecrementAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          quantityOnOffer: 800,
          startAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      ];

      for (const def of auctionDefinitions) {
        if (!def.harvest) continue;

        const existing = await auctionRepo.findOne({
          where: { harvestId: def.harvest.id, status: def.status },
        });

        if (!existing) {
          // Check if there is already an active or scheduled auction for this harvest before creating
          if (def.status === AuctionStatus.ACTIVE || def.status === AuctionStatus.SCHEDULED) {
            const hasActiveOrScheduled = await auctionRepo.findOne({
              where: [
                { harvestId: def.harvest.id, status: AuctionStatus.ACTIVE },
                { harvestId: def.harvest.id, status: AuctionStatus.SCHEDULED },
              ],
            });
            if (hasActiveOrScheduled) {
              continue;
            }
          }

          const auction = auctionRepo.create({
            harvestId: def.harvest.id,
            farmerProfileId: def.farmerProfileId,
            status: def.status,
            startingPrice: def.startingPrice,
            reservePrice: def.reservePrice,
            currentPrice: def.currentPrice,
            priceDecrementAmount: def.priceDecrementAmount,
            priceDecrementIntervalMinutes: def.priceDecrementIntervalMinutes,
            nextDecrementAt: def.nextDecrementAt,
            quantityOnOffer: def.quantityOnOffer,
            currency: 'CDF',
            exchangeRate: 2300.0,
            startAt: def.startAt,
            endAt: def.endAt,
          });
          await auctionRepo.save(auction);
        } else if (def.status === AuctionStatus.ACTIVE) {
          // Refresh active auction dates so it stays live and accessible
          existing.startAt = def.startAt;
          existing.endAt = def.endAt;
          existing.currentPrice = def.currentPrice;
          existing.nextDecrementAt = def.nextDecrementAt;
          if (existing.currency !== 'CDF' || Number(existing.exchangeRate) !== 2300.0) {
            existing.currency = 'CDF';
            existing.exchangeRate = 2300.0;
          }
          await auctionRepo.save(existing);
        }
      }

      // Ensure all auctions in the database are set to CDF currency
      const allAuctionsInDb = await auctionRepo.find();
      for (const a of allAuctionsInDb) {
        if (a.currency !== 'CDF' || Number(a.exchangeRate) !== 2300.0) {
          a.currency = 'CDF';
          a.exchangeRate = 2300.0;
          await auctionRepo.save(a);
        }
      }

      this.logger.log('Auctions catalogue verified successfully.');
    }

    // =========================================================================
    // SEED: Platform Fees (Frais additionnels configurables)
    // =========================================================================
    const feeRepo = this.userRepository.manager.getRepository(PlatformFeeEntity);
    const existingFeesCount = await feeRepo.count();

    if (existingFeesCount === 0) {
      this.logger.log('Seeding initial platform fees...');
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
        const fee = feeRepo.create(feeData);
        await feeRepo.save(fee);
      }
      this.logger.log('Platform fees seeded successfully.');
    }

    // 16. Seed Default Addresses for Users
    const addressRepo = this.userRepository.manager.getRepository(AddressEntity);
    const existingAddressesCount = await addressRepo.count();
    if (existingAddressesCount === 0) {
      this.logger.log('Seeding default addresses for users...');
      const allUsers = await this.userRepository.find({ relations: { roles: true } });

      for (const user of allUsers) {
        const roleNames = user.roles?.map((r) => r.name) || [];
        const isBuyer = roleNames.includes('buyer') || user.email.includes('buyer') || user.email.includes('khadija');
        const isFarmer = roleNames.includes('farmer') || user.email.includes('farmer');

        if (isBuyer) {
          const addr1 = addressRepo.create({
            addressableType: AddressableType.USER,
            addressableId: user.id,
            type: AddressType.SHIPPING,
            label: 'Domicile (Principal)',
            recipientName: `${user.firstName || 'Khadija'} ${user.lastName || 'Sy'}`,
            phoneNumber: '+243998765432',
            streetAddress: '12 Boulevard du 30 Juin',
            streetAddress2: 'Résidence Flamboyant, Apt 4B',
            city: 'Kinshasa',
            stateOrProvince: 'Kinshasa',
            postalCode: '10000',
            country: 'COD',
            isDefault: true,
          });
          const addr2 = addressRepo.create({
            addressableType: AddressableType.USER,
            addressableId: user.id,
            type: AddressType.SHIPPING,
            label: 'Bureau',
            recipientName: `${user.firstName || 'Khadija'} ${user.lastName || 'Sy'}`,
            phoneNumber: '+243812345678',
            streetAddress: '45 Avenue de la Paix',
            streetAddress2: 'Immeuble Futur, 2e étage',
            city: 'Kinshasa',
            stateOrProvince: 'Kinshasa',
            postalCode: '10000',
            country: 'COD',
            isDefault: false,
          });
          await addressRepo.save([addr1, addr2]);
        } else if (isFarmer) {
          const farmAddr = addressRepo.create({
            addressableType: AddressableType.USER,
            addressableId: user.id,
            type: AddressType.COLLECTION,
            label: 'Ferme Principale',
            recipientName: `${user.firstName || 'Producteur'} ${user.lastName || 'Agricole'}`,
            phoneNumber: '+243990011223',
            streetAddress: 'Route de Maluku Km 18',
            city: 'Kinshasa',
            stateOrProvince: 'Kinshasa',
            postalCode: '10000',
            country: 'COD',
            isDefault: true,
          });
          await addressRepo.save(farmAddr);
        }
      }
      this.logger.log('Default addresses seeded successfully.');
    }

    this.logger.log('Database seeding complete.');
  }
}


