import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { UserEntity } from '../users/entities/user.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { InspectorProfileEntity } from '../inspections/entities/inspector-profile.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitEntity,
      UserEntity,
      FarmerProfileEntity,
      HarvestEntity,
      InspectionReportEntity,
      InspectorProfileEntity,
      OrderLineEntity,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
