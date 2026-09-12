import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformFeeEntity } from './entities/platform-fee.entity';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformFeeEntity])],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService, TypeOrmModule],
})
export class FeesModule {}
