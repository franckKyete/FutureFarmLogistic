import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitEntity, UserEntity, HarvestEntity, InspectionReportEntity]),
    AuthModule,
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
