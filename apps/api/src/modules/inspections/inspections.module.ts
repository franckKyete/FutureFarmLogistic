import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { InspectorProfileEntity } from './entities/inspector-profile.entity';
import { InspectionReportEntity } from './entities/inspection-report.entity';
import { InspectionPhotoEntity } from './entities/inspection-photo.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { ProductEntity } from '../products/entities/product.entity';

import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { HarvestClassifyController } from './harvest-classify.controller';
import { GeminiVisionProvider } from './providers/gemini-vision.provider';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectorProfileEntity,
      InspectionReportEntity,
      InspectionPhotoEntity,
      UserEntity,
      HarvestEntity,
      ProductEntity,
    ]),
    ConfigModule,
    AuthModule,
  ],
  controllers: [InspectionsController, HarvestClassifyController],
  providers: [
    InspectionsService,
    {
      provide: 'QUALITY_VISION_PROVIDER',
      useClass: GeminiVisionProvider,
    },
  ],
  exports: [InspectionsService],
})
export class InspectionsModule {}
