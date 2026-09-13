import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { VehicleEntity } from './entities/vehicle.entity';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { DriverLocationEntity } from './entities/driver-location.entity';
import { DriverProfileEntity } from './entities/driver-profile.entity';
import { UserEntity } from '../users/entities/user.entity';

// Cross-module entities needed by LogisticsService
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';

import { VehiclesService } from './vehicles.service';
import { LogisticsService } from './logistics.service';
import { DriverProfileService } from './driver-profile.service';
import { VehiclesController } from './vehicles.controller';
import { LogisticsController } from './logistics.controller';
import { DriverProfileController } from './driver-profile.controller';
import { LogisticsGateway } from './logistics.gateway';

import {
  ROUTE_OPTIMIZER_PORT,
  OsrmRouteOptimizer,
} from './interfaces/route-optimizer.port';
import { STORAGE_PORT } from './interfaces/storage.port';
import { StorageService } from '../storage/storage.service';

import { OrdersModule } from '../orders/orders.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VehicleEntity,
      DeliveryRunEntity,
      DeliveryStopEntity,
      DriverLocationEntity,
      DriverProfileEntity,
      UserEntity,
      // Needed for direct repository access (deliver line propagation & report lookup)
      OrderLineEntity,
      InspectionReportEntity,
    ]),
    ConfigModule,
    OrdersModule,
    InspectionsModule,
    NotificationsModule,
  ],
  controllers: [LogisticsController, VehiclesController, DriverProfileController],
  providers: [
    VehiclesService,
    LogisticsGateway,
    {
      // Expose gateway under a string token so LogisticsService can inject it
      // without a circular dependency on the class itself.
      provide: 'LOGISTICS_GATEWAY',
      useExisting: LogisticsGateway,
    },
    LogisticsService,
    DriverProfileService,
    {
      provide: ROUTE_OPTIMIZER_PORT,
      useClass: OsrmRouteOptimizer,
    },
    {
      provide: STORAGE_PORT,
      useExisting: StorageService,
    },
  ],
  exports: [LogisticsService, VehiclesService, DriverProfileService],
})
export class LogisticsModule {}
