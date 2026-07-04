import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionsSchedulerService } from './auctions-scheduler.service';
import { AuctionsGateway } from './auctions.gateway';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuctionEntity,
      BidEntity,
      HarvestEntity,
      FarmerProfileEntity,
    ]),
    OrdersModule,
  ],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionsSchedulerService, AuctionsGateway],
  exports: [AuctionsService],
})
export class AuctionsModule {}
