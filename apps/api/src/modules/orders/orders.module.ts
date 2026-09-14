import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { PaymentRecordEntity } from './entities/payment-record.entity';
import { BasketEntity } from './entities/basket.entity';
import { BasketLineEntity } from './entities/basket-line.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { UserEntity } from '../users/entities/user.entity';
import { BasketService } from './basket.service';
import { OrdersService } from './orders.service';
import { BasketController } from './basket.controller';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { FeesModule } from '../fees/fees.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { StripePaymentGateway } from './adapters/stripe.adapter';
import { PawaPayPaymentGateway } from './adapters/pawapay.adapter';
import { CompositePaymentGateway } from './adapters/composite-payment.adapter';
import { PAYMENT_GATEWAY_PORT, MockPaymentGateway } from './interfaces/payment-gateway.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderLineEntity,
      PaymentRecordEntity,
      BasketEntity,
      BasketLineEntity,
      HarvestEntity,
      FarmerProfileEntity,
      UserEntity,
    ]),
    ProductsModule,
    NotificationsModule,
    CurrenciesModule,
    FeesModule,
    forwardRef(() => LogisticsModule),
  ],
  controllers: [BasketController, OrdersController],
  providers: [
    BasketService,
    OrdersService,
    MockPaymentGateway,
    StripePaymentGateway,
    PawaPayPaymentGateway,
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: CompositePaymentGateway,
    },
  ],
  exports: [OrdersService, StripePaymentGateway],
})
export class OrdersModule {}
