import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { FarmerProfileEntity } from './entities/farmer-profile.entity';
import { BuyerProfileEntity } from './entities/buyer-profile.entity';
import { ParcelEntity } from './entities/parcel.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { InspectionCenterEntity } from '../inspections/entities/inspection-center.entity';
import { InspectorCenterAssignmentEntity } from '../inspections/entities/inspector-center-assignment.entity';
import { DriverProfileEntity } from '../logistics/entities/driver-profile.entity';
import { VehicleEntity } from '../logistics/entities/vehicle.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import { AddressesModule } from '../addresses/addresses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      FarmerProfileEntity,
      BuyerProfileEntity,
      ParcelEntity,
      InspectorProfileEntity,
      DriverProfileEntity,
      VehicleEntity,
      InspectionCenterEntity,
      InspectorCenterAssignmentEntity,
    ]),
    NotificationsModule,
    OrdersModule,
    AddressesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
