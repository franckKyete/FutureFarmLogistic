import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { OrdersModule } from '../orders/orders.module';
import { DisputesModule } from '../disputes/disputes.module';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    UsersModule,
    AuctionsModule,
    LogisticsModule,
    InspectionsModule,
    OrdersModule,
    DisputesModule,
    AuthModule,
    ProductsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
