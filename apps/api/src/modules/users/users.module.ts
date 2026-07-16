import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { FarmerProfileEntity } from './entities/farmer-profile.entity';
import { BuyerProfileEntity } from './entities/buyer-profile.entity';
import { ParcelEntity } from './entities/parcel.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { DriverProfileEntity } from '../logistics/entities/driver-profile.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

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
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
