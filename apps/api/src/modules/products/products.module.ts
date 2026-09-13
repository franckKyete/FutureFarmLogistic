import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { ProductEntity } from './entities/product.entity';
import { HarvestEntity } from './entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { ParcelEntity } from '../users/entities/parcel.entity';
import { InspectionCenterEntity } from '../inspections/entities/inspection-center.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { InspectionPhotoEntity } from '../inspections/entities/inspection-photo.entity';
import { VisitEntity } from '../visits/entities/visit.entity';

import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      HarvestEntity,
      FarmerProfileEntity,
      ParcelEntity,
      InspectionCenterEntity,
      InspectorProfileEntity,
      InspectionReportEntity,
      InspectionPhotoEntity,
      VisitEntity,
    ]),
    ConfigModule,
    AuthModule,
    CurrenciesModule,
    NotificationsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
