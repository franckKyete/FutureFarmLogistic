import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  CheckoutDto,
  RejectOrderLineDto,
  PaginatedResult,
  Permission,
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { PaymentRecordEntity } from './entities/payment-record.entity';
import { BasketEntity } from './entities/basket.entity';
import { BasketStatus } from './entities/basket-status.enum';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { BuyerProfileEntity } from '../users/entities/buyer-profile.entity';
import { UserEntity } from '../users/entities/user.entity';
import { DeliveryStopEntity } from '../logistics/entities/delivery-stop.entity';
import { BidEntity } from '../auctions/entities/bid.entity';
import { AuctionEntity } from '../auctions/entities/auction.entity';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PAYMENT_GATEWAY_PORT, PaymentGatewayPort } from './interfaces/payment-gateway.port';
import { StripePaymentGateway } from './adapters/stripe.adapter';
import { CurrenciesService } from '../currencies/currencies.service';
import { FeesService } from '../fees/fees.service';
import Stripe from 'stripe';
import PDFDocument from 'pdfkit';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepository: Repository<OrderLineEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepository: Repository<FarmerProfileEntity>,
    private readonly productsService: ProductsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
    @Optional()
    private readonly stripeGateway?: StripePaymentGateway,
    @Optional()
    private readonly currenciesService?: CurrenciesService,
    @Optional()
    private readonly feesService?: FeesService,
    @Optional()
    private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  async checkout(
    buyerId: string,
    dto: CheckoutDto,
  ): Promise<{ order: OrderEntity; paymentUrl?: string }> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const basket = await manager.findOne(BasketEntity, {
        where: { buyerId, status: BasketStatus.ACTIVE },
        relations: ['lines', 'lines.harvest'],
      });

      if (!basket || basket.lines.length === 0) {
        throw new BadRequestException('Basket is empty');
      }

      // Create new Order record
      const buyer = await manager.findOne(UserEntity, { where: { id: buyerId } });
      const buyerCountry = dto.deliveryAddress?.country || buyer?.country || 'COD';
      const preferredCurrency =
        dto.currency || buyer?.preferredCurrency || (buyerCountry === 'COD' ? 'CDF' : 'USD');

      if (buyer && dto.currency && buyer.preferredCurrency !== dto.currency) {
        buyer.preferredCurrency = dto.currency;
        await manager.save(UserEntity, buyer);
      }

      let currency = preferredCurrency;
      let exchangeRate = 1.0;
      if (this.currenciesService) {
        const snap = await this.currenciesService.getRateSnapshot(preferredCurrency);
        currency = snap.currency;
        exchangeRate = snap.exchangeRate;
      }

      const order = new OrderEntity();
      order.buyerId = buyerId;
      order.status = OrderStatus.PENDING_PAYMENT;
      order.paymentStatus = PaymentStatus.PENDING;
      order.deliveryAddress = dto.deliveryAddress;
      order.notes = dto.notes ?? null;
      order.currency = currency;
      order.exchangeRate = exchangeRate;
      order.totalAmount = 0;
      order.totalAmountUSD = 0;
      order.cancellationFee = 0;
      order.fees = [];

      const savedOrder = await manager.save(OrderEntity, order);
      const lines: OrderLineEntity[] = [];
      let totalAmount = 0;

      for (const line of basket.lines) {
        // Lock harvest row to prevent double-booking
        const harvest = await manager.findOne(HarvestEntity, {
          where: { id: line.harvestId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!harvest) {
          throw new NotFoundException(`Harvest batch ${line.harvestId} not found`);
        }

        const effectiveStock = Number(harvest.quantityInStock) - Number(harvest.stockMarge);
        if (line.quantity > effectiveStock) {
          throw new BadRequestException(
            `Quantity for crop ${harvest.id} (${line.quantity}) exceeds available stock (${effectiveStock})`,
          );
        }

        // Deduct from stock
        harvest.quantityInStock = Number(harvest.quantityInStock) - line.quantity;
        await manager.save(HarvestEntity, harvest);

        // Fetch decayed price details
        const priceDetails = await this.productsService.getDecayedPrice(harvest.id);
        const harvestCurrency = harvest.currency || 'CDF';
        const harvestRate = Number(harvest.exchangeRate) || 1.0;

        let unitPriceInCurrency: number;
        if (harvestCurrency === currency) {
          unitPriceInCurrency = Number(priceDetails.decayedPrice);
        } else {
          unitPriceInCurrency = Number(
            ((Number(priceDetails.decayedPrice) / harvestRate) * exchangeRate).toFixed(2),
          );
        }
        const lineTotal = Number((line.quantity * unitPriceInCurrency).toFixed(2));

        const orderLine = new OrderLineEntity();
        orderLine.orderId = savedOrder.id;
        orderLine.harvestId = harvest.id;
        orderLine.farmerProfileId = harvest.farmerProfileId;
        orderLine.quantity = line.quantity;
        orderLine.unitPrice = unitPriceInCurrency;
        orderLine.totalPrice = lineTotal;
        orderLine.currency = currency;
        orderLine.exchangeRate = exchangeRate;
        orderLine.status = OrderLineStatus.PENDING;

        const savedLine = await manager.save(OrderLineEntity, orderLine);
        lines.push(savedLine);
        totalAmount += lineTotal;
      }

      // Calculate Platform Fees snapshot
      let appliedFees: any[] = [];
      let totalFeesAmount = 0;
      if (this.feesService) {
        const feeCalc = await this.feesService.calculateFeesForOrder(totalAmount, exchangeRate);
        appliedFees = feeCalc.fees;
        totalFeesAmount = feeCalc.totalFeesAmount;
      }

      const grandTotal = Number((totalAmount + totalFeesAmount).toFixed(2));
      savedOrder.totalAmount = grandTotal;
      savedOrder.totalAmountUSD = Number((grandTotal / exchangeRate).toFixed(2));
      savedOrder.fees = appliedFees;
      savedOrder.lines = lines;
      const finalOrder = await manager.save(OrderEntity, savedOrder);

      // Archive/Abandoned active basket
      basket.status = BasketStatus.ABANDONED;
      await manager.save(BasketEntity, basket);

      // Call payment gateway
      const paymentResult = await this.paymentGateway.initiatePayment(
        finalOrder,
        finalOrder.totalAmount,
        {
          paymentMethod: dto.paymentMethod,
          phoneNumber: dto.phoneNumber,
          mmoProvider: dto.mmoProvider,
        },
      );

      const paymentRecord = new PaymentRecordEntity();
      paymentRecord.orderId = finalOrder.id;
      paymentRecord.gatewayRef = paymentResult.gatewayRef;
      paymentRecord.amount = finalOrder.totalAmount;
      paymentRecord.currency = finalOrder.currency;
      paymentRecord.exchangeRate = finalOrder.exchangeRate;
      paymentRecord.amountUSD = finalOrder.totalAmountUSD;
      paymentRecord.status = paymentResult.status;
      paymentRecord.metadata = paymentResult.metadata ?? null;
      await manager.save(PaymentRecordEntity, paymentRecord);

      // Send placed notification
      await this.notificationsService.send({
        recipientIds: [buyerId],
        title: 'Order Placed',
        body: `Your order #${finalOrder.id.slice(0, 8)} has been placed. Please complete the payment.`,
        channels: [NotificationChannel.DATABASE],
      });

      const response: { order: OrderEntity; paymentUrl?: string; paymentRef?: string } = {
        order: finalOrder,
        paymentRef: paymentResult.gatewayRef,
      };
      if (paymentResult.paymentUrl) {
        response.paymentUrl = paymentResult.paymentUrl;
      }
      return response;
    });
  }

  async confirmPayment(paymentRef: string): Promise<OrderEntity> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      let paymentRecord = await manager.findOne(PaymentRecordEntity, {
        where: { gatewayRef: paymentRef },
        lock: { mode: 'pessimistic_write' },
      });

      if (!paymentRecord) {
        paymentRecord = await manager.findOne(PaymentRecordEntity, {
          where: { orderId: paymentRef },
          lock: { mode: 'pessimistic_write' },
        });
      }

      if (!paymentRecord) {
        paymentRecord = await manager
          .createQueryBuilder(PaymentRecordEntity, 'pr')
          .setLock('pessimistic_write')
          .where("pr.metadata->>'checkoutCode' = :ref", { ref: paymentRef })
          .orWhere("pr.metadata->>'checkoutId' = :ref", { ref: paymentRef })
          .getOne();
      }

      if (!paymentRecord && paymentRef.startsWith('mock-ref-')) {
        const potentialOrderId = paymentRef.replace(/^mock-ref-/, '');
        paymentRecord = await manager.findOne(PaymentRecordEntity, {
          where: { orderId: potentialOrderId },
          lock: { mode: 'pessimistic_write' },
        });
      }

      if (!paymentRecord) {
        throw new NotFoundException('Payment record not found');
      }

      const order = await manager.findOne(OrderEntity, {
        where: { id: paymentRecord.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found for payment record');
      }

      order.lines = await manager.find(OrderLineEntity, {
        where: { orderId: order.id },
        relations: ['harvest', 'harvest.product'],
      });
      paymentRecord.order = order;

      if (paymentRecord.status !== PaymentStatus.PENDING) {
        return paymentRecord.order;
      }

      const gatewayConfirm = await this.paymentGateway.confirmPayment(paymentRecord.gatewayRef);
      if (!gatewayConfirm.success) {
        if (gatewayConfirm.pending) {
          this.logger.log(`Payment ${paymentRecord.gatewayRef} is still processing`);
          paymentRecord.metadata = {
            ...paymentRecord.metadata,
            ...gatewayConfirm.metadata,
          };
          await manager.save(PaymentRecordEntity, paymentRecord);
          throw new BadRequestException(
            'Le paiement est en cours de traitement par l’opérateur Mobile Money. Veuillez patienter ou rafraîchir dans un instant.',
          );
        }

        paymentRecord.status = PaymentStatus.FAILED;
        paymentRecord.metadata = {
          ...paymentRecord.metadata,
          ...gatewayConfirm.metadata,
        };
        await manager.save(PaymentRecordEntity, paymentRecord);

        if (order) {
          order.paymentStatus = PaymentStatus.FAILED;
          await manager.save(OrderEntity, order);
        }
        throw new BadRequestException('Payment confirmation failed at gateway');
      }

      paymentRecord.status = PaymentStatus.PAID;
      paymentRecord.metadata = {
        ...paymentRecord.metadata,
        ...gatewayConfirm.metadata,
      };
      await manager.save(PaymentRecordEntity, paymentRecord);

      order.paymentStatus = PaymentStatus.PAID;
      order.status = OrderStatus.AWAITING_CONFIRMATION;
      const savedOrder = await manager.save(OrderEntity, order);

      // Notify buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Paiement confirmé',
        body: `Le paiement de votre commande #${order.id.slice(0, 8)} a été confirmé avec succès. Les producteurs préparent vos récoltes.`,
        channels: [
          NotificationChannel.DATABASE,
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
        ],
        priority: NotificationPriority.HIGH,
        metadata: {
          orderId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionText: 'Suivre la commande',
        },
      });

      // Emit real-time WebSocket update to buyer
      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: 'Paiement confirmé avec succès !',
      });

      // Group order lines per farmer to send detailed notification on what to check & prepare
      const farmerLinesMap = new Map<string, OrderLineEntity[]>();
      for (const line of order.lines || []) {
        if (!line.farmerProfileId) continue;
        const existing = farmerLinesMap.get(line.farmerProfileId) || [];
        existing.push(line);
        farmerLinesMap.set(line.farmerProfileId, existing);
      }

      for (const [farmerProfileId, lines] of farmerLinesMap.entries()) {
        const farmer = await manager.findOne(FarmerProfileEntity, {
          where: { id: farmerProfileId },
        });
        if (farmer) {
          const itemsSummary = lines
            .map((l) => {
              const productName =
                l.harvest?.product?.name || `Récolte #${l.harvestId?.slice(0, 8) || 'N/A'}`;
              const unit = l.harvest?.unit || 'unités';
              return `• ${productName} : ${l.quantity} ${unit}`;
            })
            .join('\n');

          const body =
            `Une nouvelle commande (#${order.id.slice(0, 8)}) a été payée et attend votre confirmation.\n\n` +
            `Articles à vérifier et préparer :\n${itemsSummary}\n\n` +
            `Veuillez inspecter la qualité et la conformité de vos récoltes, puis confirmer la commande sur votre espace producteur.`;

          await this.notificationsService.send({
            recipientIds: [farmer.userId],
            title: `Nouvelle commande payée #${order.id.slice(0, 8)} - Préparation requise`,
            body,
            channels: [
              NotificationChannel.DATABASE,
              NotificationChannel.EMAIL,
              NotificationChannel.SMS,
            ],
            priority: NotificationPriority.HIGH,
            metadata: {
              orderId: order.id,
              actionUrl: '/farmer',
              actionText: 'Gérer la commande',
            },
          });

          this.notificationsGateway?.emitOrderStatusChanged(farmer.userId, {
            orderId: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
            message: `Nouvelle commande #${order.id.slice(0, 8)} payée - Produits à préparer`,
          });
        }
      }

      return savedOrder;
    });
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; eventType?: string }> {
    if (!this.stripeGateway) {
      throw new BadRequestException('Stripe gateway is not available');
    }

    const event = this.stripeGateway.constructWebhookEvent(rawBody, signature);
    this.logger.log(`Received Stripe webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.id) {
          if (session.mode === 'setup') {
            const userId = session.client_reference_id || session.metadata?.userId;
            if (userId && this.stripeGateway) {
              try {
                const pm = await this.stripeGateway.confirmSetupCheckoutSession(session.id);
                const userRepo = this.dataSource.getRepository(UserEntity);
                const user = await userRepo.findOneBy({ id: userId });
                if (user) {
                  user.stripePaymentMethodId = pm.paymentMethodId;
                  user.cardBrand = pm.brand;
                  user.cardLast4 = pm.last4;
                  user.cardExpMonth = pm.expMonth;
                  user.cardExpYear = pm.expYear;
                  await userRepo.save(user);
                  this.logger.log(`Saved Stripe payment method for user ${userId} via webhook`);
                }
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Stripe setup session webhook warning: ${msg}`);
              }
            }
          } else {
            try {
              await this.confirmPayment(session.id);
              this.logger.log(`Payment confirmed for Stripe session: ${session.id}`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Stripe webhook confirmPayment warning for session ${session.id}: ${msg}`,
              );
            }
          }
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.id) {
          await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            const paymentRecord = await manager.findOne(PaymentRecordEntity, {
              where: { gatewayRef: session.id },
              relations: ['order'],
            });
            if (paymentRecord && paymentRecord.status === PaymentStatus.PENDING) {
              paymentRecord.status = PaymentStatus.FAILED;
              await manager.save(PaymentRecordEntity, paymentRecord);
              if (paymentRecord.order) {
                paymentRecord.order.paymentStatus = PaymentStatus.FAILED;
                await manager.save(OrderEntity, paymentRecord.order);
                this.notificationsGateway?.emitOrderStatusChanged(paymentRecord.order.buyerId, {
                  orderId: paymentRecord.order.id,
                  status: paymentRecord.order.status,
                  paymentStatus: PaymentStatus.FAILED,
                  message: 'Le paiement Stripe a échoué.',
                });
              }
            }
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.id) {
          try {
            await this.confirmPayment(paymentIntent.id);
            this.logger.log(`Payment confirmed for Stripe PaymentIntent: ${paymentIntent.id}`);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Stripe webhook confirmPayment warning for intent ${paymentIntent.id}: ${msg}`,
            );
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.id) {
          await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            const paymentRecord = await manager.findOne(PaymentRecordEntity, {
              where: { gatewayRef: paymentIntent.id },
              relations: ['order'],
            });
            if (paymentRecord && paymentRecord.status === PaymentStatus.PENDING) {
              paymentRecord.status = PaymentStatus.FAILED;
              await manager.save(PaymentRecordEntity, paymentRecord);
              if (paymentRecord.order) {
                paymentRecord.order.paymentStatus = PaymentStatus.FAILED;
                await manager.save(OrderEntity, paymentRecord.order);
                this.notificationsGateway?.emitOrderStatusChanged(paymentRecord.order.buyerId, {
                  orderId: paymentRecord.order.id,
                  status: paymentRecord.order.status,
                  paymentStatus: PaymentStatus.FAILED,
                  message: 'Le paiement Stripe a échoué.',
                });
              }
            }
          });
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true, eventType: event.type };
  }

  async handlePawaPayCallback(body: any): Promise<{ received: boolean; status?: string }> {
    this.logger.log(`Received PawaPay callback: ${JSON.stringify(body)}`);

    const checkoutId = body?.checkoutId || body?.data?.checkoutId;
    const depositId = body?.depositId || body?.deposit?.depositId;
    const checkoutCode = body?.checkoutCode || body?.data?.checkoutCode;
    const status = body?.status || body?.data?.status;

    const paymentRef = checkoutId || depositId || checkoutCode;

    if (!paymentRef) {
      this.logger.warn('PawaPay callback received without identifiable reference');
      return { received: true, status: 'MISSING_REF' };
    }

    if (status === 'COMPLETED') {
      try {
        await this.confirmPayment(paymentRef);
        this.logger.log(`Payment confirmed via PawaPay callback for reference: ${paymentRef}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `PawaPay callback confirmPayment warning for ref ${paymentRef}: ${msg}`,
        );
      }
    } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
      await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        let paymentRecord = await manager.findOne(PaymentRecordEntity, {
          where: { gatewayRef: paymentRef },
          relations: ['order'],
        });
        if (!paymentRecord) {
          paymentRecord = await manager
            .createQueryBuilder(PaymentRecordEntity, 'pr')
            .leftJoinAndSelect('pr.order', 'order')
            .where("pr.metadata->>'checkoutCode' = :ref", { ref: paymentRef })
            .orWhere("pr.metadata->>'checkoutId' = :ref", { ref: paymentRef })
            .getOne();
        }
        if (paymentRecord && paymentRecord.status === PaymentStatus.PENDING) {
          paymentRecord.status = PaymentStatus.FAILED;
          paymentRecord.metadata = { ...paymentRecord.metadata, callbackStatus: status, callbackBody: body };
          await manager.save(PaymentRecordEntity, paymentRecord);
          if (paymentRecord.order) {
            paymentRecord.order.paymentStatus = PaymentStatus.FAILED;
            await manager.save(OrderEntity, paymentRecord.order);
            this.notificationsGateway?.emitOrderStatusChanged(paymentRecord.order.buyerId, {
              orderId: paymentRecord.order.id,
              status: paymentRecord.order.status,
              paymentStatus: PaymentStatus.FAILED,
              message: 'Le paiement Mobile Money a échoué.',
            });
          }
        }
      });
    }

    return { received: true, status };
  }

  async retryPayment(
    orderId: string,
    userId: string,
    permissions: Permission[],
  ): Promise<{ order: OrderEntity; paymentUrl?: string }> {
    const order = await this.getOrder(orderId);
    const isAdmin = permissions.includes(Permission.ORDER_READ_ALL);
    const isBuyer = order.buyerId === userId;

    if (!isAdmin && !isBuyer) {
      throw new ForbiddenException('You do not have access to pay for this order');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Payment can only be retried for pending orders');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const lastPayment = await manager.findOne(PaymentRecordEntity, {
        where: { orderId: order.id },
        order: { createdAt: 'DESC' },
      });
      const previousProvider = lastPayment?.metadata?.provider;
      const previousPhone = lastPayment?.metadata?.payerPhone;

      const paymentResult = previousProvider
        ? await this.paymentGateway.initiatePayment(order, order.totalAmount, {
            paymentMethod: previousProvider,
            phoneNumber: previousPhone,
          })
        : await this.paymentGateway.initiatePayment(order, order.totalAmount);

      const paymentRecord = new PaymentRecordEntity();
      paymentRecord.orderId = order.id;
      paymentRecord.gatewayRef = paymentResult.gatewayRef;
      paymentRecord.amount = order.totalAmount;
      paymentRecord.status = paymentResult.status;
      paymentRecord.metadata = paymentResult.metadata ?? null;
      await manager.save(PaymentRecordEntity, paymentRecord);

      order.paymentStatus = PaymentStatus.PENDING;
      const savedOrder = await manager.save(OrderEntity, order);

      const response: { order: OrderEntity; paymentUrl?: string } = {
        order: savedOrder,
      };
      if (paymentResult.paymentUrl) {
        response.paymentUrl = paymentResult.paymentUrl;
      }
      return response;
    });
  }

  async confirmOrderLine(
    userId: string,
    orderId: string,
    lineId: string,
  ): Promise<OrderLineEntity> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User is not a farmer');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.AWAITING_CONFIRMATION) {
        throw new ConflictException('Order is not in confirmation phase');
      }

      const line = await manager.findOne(OrderLineEntity, {
        where: { id: lineId, orderId },
      });
      if (!line) {
        throw new NotFoundException('Order line not found');
      }

      if (line.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException('You do not own this order line');
      }

      if (line.status !== OrderLineStatus.PENDING) {
        throw new ConflictException('Order line is already processed');
      }

      line.status = OrderLineStatus.CONFIRMED;
      const savedLine = await manager.save(OrderLineEntity, line);

      // Check if all lines are processed
      const updatedLines = await manager.find(OrderLineEntity, {
        where: { orderId },
      });
      const allProcessed = updatedLines.every((l) => l.status !== OrderLineStatus.PENDING);

      if (allProcessed) {
        const anyConfirmed = updatedLines.some((l) => l.status === OrderLineStatus.CONFIRMED);
        if (anyConfirmed) {
          order.status = OrderStatus.CONFIRMED;
        } else {
          order.status = OrderStatus.CANCELLED;
        }
        await manager.save(OrderEntity, order);
      }

      // Notify Buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Order Line Confirmed',
        body: `A farmer has confirmed items in your order #${order.id.slice(0, 8)}.`,
        channels: [NotificationChannel.DATABASE],
      });

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Articles de votre commande #${order.id.slice(0, 8)} confirmés`,
      });

      return savedLine;
    });
  }

  async rejectOrderLine(
    userId: string,
    orderId: string,
    lineId: string,
    dto: RejectOrderLineDto,
  ): Promise<OrderLineEntity> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User is not a farmer');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.AWAITING_CONFIRMATION) {
        throw new ConflictException('Order is not in confirmation phase');
      }

      const line = await manager.findOne(OrderLineEntity, {
        where: { id: lineId, orderId },
        relations: ['harvest'],
      });
      if (!line) {
        throw new NotFoundException('Order line not found');
      }

      if (line.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException('You do not own this order line');
      }

      if (line.status !== OrderLineStatus.PENDING) {
        throw new ConflictException('Order line is already processed');
      }

      line.status = OrderLineStatus.REJECTED;
      line.rejectionReason = dto.reason;
      const savedLine = await manager.save(OrderLineEntity, line);

      // Refund stock
      const harvest = line.harvest;
      harvest.quantityInStock = Number(harvest.quantityInStock) + Number(line.quantity);
      await manager.save(HarvestEntity, harvest);

      // Refund amount for this line
      const paymentRecord = await manager.findOne(PaymentRecordEntity, {
        where: { orderId, status: PaymentStatus.PAID },
      });
      if (paymentRecord) {
        await this.paymentGateway.refundPayment(paymentRecord.gatewayRef, line.totalPrice);
      }

      // Check if all lines are processed
      const updatedLines = await manager.find(OrderLineEntity, {
        where: { orderId },
      });
      const allProcessed = updatedLines.every((l) => l.status !== OrderLineStatus.PENDING);

      if (allProcessed) {
        const anyConfirmed = updatedLines.some((l) => l.status === OrderLineStatus.CONFIRMED);
        if (anyConfirmed) {
          order.status = OrderStatus.CONFIRMED;
        } else {
          order.status = OrderStatus.CANCELLED;
          order.paymentStatus = PaymentStatus.REFUNDED;
        }
        await manager.save(OrderEntity, order);
      }

      // Notify Buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Order Line Rejected',
        body: `A farmer rejected items in your order #${order.id.slice(0, 8)}: ${dto.reason}`,
        channels: [NotificationChannel.DATABASE],
      });

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Article de la commande #${order.id.slice(0, 8)} rejeté par le producteur`,
      });

      return savedLine;
    });
  }

  async shipOrderLines(userId: string, orderId: string): Promise<OrderLineEntity[]> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User is not a farmer');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const farmerLines = order.lines.filter(
        (l) => l.farmerProfileId === farmerProfile.id && l.status === OrderLineStatus.CONFIRMED,
      );

      if (farmerLines.length === 0) {
        throw new BadRequestException('No confirmed lines to ship');
      }

      for (const line of farmerLines) {
        line.status = OrderLineStatus.SHIPPED;
        await manager.save(OrderLineEntity, line);
      }

      const updatedLines = await manager.find(OrderLineEntity, {
        where: { orderId },
      });
      const nonRejected = updatedLines.filter((l) => l.status !== OrderLineStatus.REJECTED);
      const allShippedOrDelivered = nonRejected.every(
        (l) => l.status === OrderLineStatus.SHIPPED || l.status === OrderLineStatus.DELIVERED,
      );

      if (allShippedOrDelivered) {
        order.status = OrderStatus.SHIPPED;
        await manager.save(OrderEntity, order);
      }

      // Notify Buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Order Shipped',
        body: `Your order #${order.id.slice(0, 8)} has been marked as shipped.`,
        channels: [NotificationChannel.DATABASE],
      });

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Votre commande #${order.id.slice(0, 8)} a été expédiée`,
      });

      return farmerLines;
    });
  }

  async deliverOrderLines(userId: string, orderId: string): Promise<OrderLineEntity[]> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User is not a farmer');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const farmerLines = order.lines.filter(
        (l) => l.farmerProfileId === farmerProfile.id && l.status === OrderLineStatus.SHIPPED,
      );

      if (farmerLines.length === 0) {
        throw new BadRequestException('No shipped lines to deliver');
      }

      for (const line of farmerLines) {
        line.status = OrderLineStatus.DELIVERED;
        await manager.save(OrderLineEntity, line);
      }

      const updatedLines = await manager.find(OrderLineEntity, {
        where: { orderId },
      });
      const nonRejected = updatedLines.filter((l) => l.status !== OrderLineStatus.REJECTED);
      const allDelivered = nonRejected.every((l) => l.status === OrderLineStatus.DELIVERED);

      if (allDelivered) {
        order.status = OrderStatus.DELIVERED;
        await manager.save(OrderEntity, order);
      }

      // Notify Buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Order Delivered',
        body: `Your order #${order.id.slice(0, 8)} has been delivered.`,
        channels: [NotificationChannel.DATABASE],
      });

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Votre commande #${order.id.slice(0, 8)} a été livrée`,
      });

      return farmerLines;
    });
  }

  async cancelOrder(userId: string, orderId: string): Promise<OrderEntity> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines', 'lines.harvest'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.buyerId !== userId) {
        throw new ForbiddenException('You cannot cancel this order');
      }

      const cancellableStatuses = [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.AWAITING_CONFIRMATION,
        OrderStatus.CONFIRMED,
      ];
      if (!cancellableStatuses.includes(order.status)) {
        throw new ConflictException('Order cannot be cancelled in its current state');
      }

      let fee = 0;
      if (order.status === OrderStatus.CONFIRMED) {
        // Apply 10% fee if order was already confirmed by farmers
        fee = Number((order.totalAmount * 0.1).toFixed(2));
      }

      const refundAmount = Number((order.totalAmount - fee).toFixed(2));

      // Update statuses
      order.status = OrderStatus.CANCELLED;
      order.cancellationFee = fee;
      order.cancelledReason = 'Cancelled by buyer';

      // Refund payment if paid
      if (order.paymentStatus === PaymentStatus.PAID) {
        const paymentRecord = await manager.findOne(PaymentRecordEntity, {
          where: { orderId, status: PaymentStatus.PAID },
        });
        if (paymentRecord && refundAmount > 0) {
          await this.paymentGateway.refundPayment(paymentRecord.gatewayRef, refundAmount);
          paymentRecord.status = PaymentStatus.REFUNDED;
          await manager.save(PaymentRecordEntity, paymentRecord);
        }
        order.paymentStatus = PaymentStatus.REFUNDED;
      }

      // Refund stock for non-rejected lines
      for (const line of order.lines) {
        if (line.status !== OrderLineStatus.REJECTED) {
          const harvest = line.harvest;
          harvest.quantityInStock = Number(harvest.quantityInStock) + Number(line.quantity);
          await manager.save(HarvestEntity, harvest);
        }
      }

      const savedOrder = await manager.save(OrderEntity, order);

      // Notify Buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Order Cancelled',
        body: `Your order #${order.id.slice(0, 8)} has been cancelled.`,
        channels: [NotificationChannel.DATABASE],
      });

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Votre commande #${order.id.slice(0, 8)} a été annulée`,
      });

      return savedOrder;
    });
  }

  // =============================================================================
  // Admin Operations
  // =============================================================================

  async cancelOrderForce(orderId: string): Promise<OrderEntity> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['lines', 'lines.harvest'],
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledReason = 'Force cancelled by Admin';

      if (order.paymentStatus === PaymentStatus.PAID) {
        const paymentRecord = await manager.findOne(PaymentRecordEntity, {
          where: { orderId, status: PaymentStatus.PAID },
        });
        if (paymentRecord) {
          await this.paymentGateway.refundPayment(paymentRecord.gatewayRef, order.totalAmount);
          paymentRecord.status = PaymentStatus.REFUNDED;
          await manager.save(PaymentRecordEntity, paymentRecord);
        }
        order.paymentStatus = PaymentStatus.REFUNDED;
      }

      for (const line of order.lines) {
        if (line.status !== OrderLineStatus.REJECTED) {
          const harvest = line.harvest;
          harvest.quantityInStock = Number(harvest.quantityInStock) + Number(line.quantity);
          await manager.save(HarvestEntity, harvest);
        }
      }

      const saved = await manager.save(OrderEntity, order);

      this.notificationsGateway?.emitOrderStatusChanged(order.buyerId, {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: `Votre commande #${order.id.slice(0, 8)} a été annulée par l'administrateur`,
      });

      return saved;
    });
  }

  async refundOrderManual(orderId: string): Promise<OrderEntity> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.paymentStatus !== PaymentStatus.PAID) {
        throw new BadRequestException('Order payment status is not PAID');
      }

      const paymentRecord = await manager.findOne(PaymentRecordEntity, {
        where: { orderId, status: PaymentStatus.PAID },
      });
      if (paymentRecord) {
        await this.paymentGateway.refundPayment(paymentRecord.gatewayRef, order.totalAmount);
        paymentRecord.status = PaymentStatus.REFUNDED;
        await manager.save(PaymentRecordEntity, paymentRecord);
      }

      order.paymentStatus = PaymentStatus.REFUNDED;
      return manager.save(OrderEntity, order);
    });
  }

  async overrideFee(orderId: string, newFee: number): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (newFee < 0) {
      throw new BadRequestException('Fee cannot be negative');
    }

    order.cancellationFee = newFee;
    return this.orderRepository.save(order);
  }

  // =============================================================================
  // Auction Module Integration
  // =============================================================================

  async createFromBid(
    bid: BidEntity,
    auction: AuctionEntity,
    manager: any,
    options?: {
      paymentIntentId?: string;
      deliveryAddress?: any;
    },
  ): Promise<OrderEntity> {
    // Check stock reduction is already done by the auction system creating the auction,
    // so here we don't deduct stock again. We just map the bid and won lot to the Order entities.

    const currency = auction.currency || 'USD';
    const exchangeRate = Number(auction.exchangeRate) || 1.0;
    const totalAmount = Number(bid.priceAtBid) * Number(bid.quantityWon);
    const totalAmountUSD = Number((totalAmount / exchangeRate).toFixed(2));

    let resolvedAddress = options?.deliveryAddress || bid.deliveryAddress;
    if (!resolvedAddress) {
      const buyerProfile = await manager.findOne(BuyerProfileEntity, {
        where: { userId: bid.buyerId },
      });
      if (buyerProfile?.shippingAddress) {
        resolvedAddress = {
          street: buyerProfile.shippingAddress,
          city: 'Kinshasa',
          country: 'COD',
          postalCode: '10000',
        };
      } else {
        resolvedAddress = {
          street: 'Adresse de livraison acheteur',
          city: 'Kinshasa',
          country: 'COD',
          postalCode: '10000',
        };
      }
    } else if (typeof resolvedAddress === 'string') {
      resolvedAddress = {
        street: resolvedAddress,
        city: 'Kinshasa',
        country: 'COD',
        postalCode: '10000',
      };
    }

    const order = new OrderEntity();
    order.buyerId = bid.buyerId;
    order.status = OrderStatus.PENDING_PAYMENT;
    order.paymentStatus = PaymentStatus.PENDING;
    order.totalAmount = totalAmount;
    order.currency = currency;
    order.exchangeRate = exchangeRate;
    order.totalAmountUSD = totalAmountUSD;
    order.cancellationFee = 0;
    order.deliveryAddress = resolvedAddress;
    order.notes = `Won via Auction Lot #${auction.id.slice(0, 8)}`;
    order.auctionBidId = bid.id;

    const savedOrder = await manager.save(OrderEntity, order);

    const orderLine = new OrderLineEntity();
    orderLine.orderId = savedOrder.id;
    orderLine.harvestId = auction.harvestId;
    orderLine.farmerProfileId = auction.farmerProfileId;
    orderLine.quantity = bid.quantityWon;
    orderLine.unitPrice = bid.priceAtBid;
    orderLine.totalPrice = totalAmount;
    orderLine.currency = currency;
    orderLine.exchangeRate = exchangeRate;
    orderLine.status = OrderLineStatus.PENDING;

    await manager.save(OrderLineEntity, orderLine);

    const paymentRecord = new PaymentRecordEntity();
    paymentRecord.orderId = savedOrder.id;
    paymentRecord.gatewayRef = options?.paymentIntentId || `auction-bid-payment-${bid.id}`;
    paymentRecord.amount = totalAmount;
    paymentRecord.currency = currency;
    paymentRecord.exchangeRate = exchangeRate;
    paymentRecord.amountUSD = totalAmountUSD;
    paymentRecord.status = PaymentStatus.PENDING;
    paymentRecord.metadata = {
      provider: 'stripe',
      auctionId: auction.id,
      bidId: bid.id,
      wonAt: new Date().toISOString(),
    };
    await manager.save(PaymentRecordEntity, paymentRecord);

    return savedOrder;
  }

  // =============================================================================
  // Queries
  // =============================================================================

  async getOrder(orderId: string): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'lines',
        'lines.harvest',
        'lines.harvest.product',
        'lines.farmerProfile',
        'lines.farmerProfile.user',
        'buyer',
      ],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Populate live delivery / driver info if confirmed and assigned
    try {
      const isConfirmedOrShipped =
        order.status === OrderStatus.CONFIRMED ||
        order.status === OrderStatus.SHIPPED ||
        order.status === OrderStatus.DELIVERED;

      if (isConfirmedOrShipped) {
        const stopRepo = this.dataSource.getRepository(DeliveryStopEntity);
        const lineIds = (order.lines || []).map((l) => l.id);
        if (lineIds.length > 0) {
          const stop = await stopRepo.findOne({
            where: { orderLineId: In(lineIds) },
            relations: ['run', 'run.driver', 'run.vehicle'],
          });
          if (stop && stop.run?.driver) {
            (order as any).delivery = {
              mode: 'Transporteur propre',
              driverName: `${stop.run.driver.firstName} ${stop.run.driver.lastName}`.trim(),
              driverPhone: stop.run.driver.phoneNumber ?? null,
              vehiclePlate: stop.run.vehicle?.registrationPlate ?? null,
              vehicleType: stop.run.vehicle?.type ?? null,
              status: stop.status,
              eta: stop.eta ? stop.eta.toISOString() : null,
            };
          } else {
            (order as any).delivery = {
              mode: 'Transporteur propre',
              driverName: null,
              driverPhone: null,
              vehiclePlate: null,
              vehicleType: null,
              status: stop?.status ?? 'PENDING',
              eta: null,
            };
          }
        }
      } else {
        // Driver cannot be assigned to an order that has not been confirmed yet
        (order as any).delivery = {
          mode: 'Transporteur propre',
          driverName: null,
          driverPhone: null,
          vehiclePlate: null,
          vehicleType: null,
          status: 'PENDING',
          eta: null,
        };
      }
    } catch {
      // ignore if logistics entities are mocked in unit tests
    }

    return order;
  }

  async generateOrderPdf(
    orderId: string,
    userId: string,
    permissions: Permission[],
  ): Promise<Buffer> {
    const order = await this.getOrderForUser(orderId, userId, permissions);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Bon de Commande #ORD-${order.id.slice(0, 8).toUpperCase()}`,
            Author: 'FutureFarm',
            Subject: 'Bon de Commande',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const primaryColor = '#004322';
        const secondaryColor = '#404941';
        const mutedColor = '#707970';
        const lightBg = '#f8f9fa';

        // Top brand bar
        doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);

        // Header Title & Logo
        doc.fillColor(primaryColor)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('FUTUREFARM', 40, 35);

        doc.fillColor(secondaryColor)
          .fontSize(9)
          .font('Helvetica')
          .text('Plateforme Agricole Intelligente & Logistique', 40, 62);

        // Document Meta (Right aligned)
        const orderRef = `#ORD-${order.id.slice(0, 8).toUpperCase()}`;
        doc.fillColor(primaryColor)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('BON DE COMMANDE', 320, 35, { align: 'right', width: 235 });

        const formattedDate = new Date(order.createdAt).toLocaleDateString('fr-FR');
        doc.fillColor(secondaryColor)
          .fontSize(9)
          .font('Helvetica')
          .text(`Réf : ${orderRef}`, 320, 52, { align: 'right', width: 235 })
          .text(`Date : ${formattedDate}`, 320, 64, { align: 'right', width: 235 })
          .text(`Statut : ${order.status}`, 320, 76, { align: 'right', width: 235 });

        // Divider
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 95).lineTo(555, 95).stroke();

        // 2-Column Info Boxes (Acheteur / Livraison)
        const boxTop = 110;
        const boxWidth = 245;
        const boxHeight = 100;

        // Box 1: Acheteur
        doc.rect(40, boxTop, boxWidth, boxHeight).fill(lightBg);
        doc.rect(40, boxTop, boxWidth, boxHeight).strokeColor('#e2e8f0').stroke();

        doc.fillColor(mutedColor)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('CLIENT / ACHETEUR', 52, boxTop + 10);

        const buyerName = order.buyer
          ? `${order.buyer.firstName} ${order.buyer.lastName}`.trim()
          : 'Client FutureFarm';
        const buyerPhone = order.buyer?.phoneNumber || 'Non renseigné';
        const buyerEmail = order.buyer?.email || '';
        const buyerAddress = order.deliveryAddress
          ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''} ${order.deliveryAddress.country || ''}`
          : 'Non renseignée';

        doc.fillColor(secondaryColor)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(buyerName, 52, boxTop + 24)
          .font('Helvetica')
          .fontSize(9)
          .text(`Tél : ${buyerPhone}`, 52, boxTop + 40)
          .text(`Email : ${buyerEmail}`, 52, boxTop + 54, { width: 220 })
          .text(`Adresse : ${buyerAddress}`, 52, boxTop + 68, { width: 220 });

        // Box 2: Livraison & Paiement
        const box2Left = 310;
        doc.rect(box2Left, boxTop, boxWidth, boxHeight).fill(lightBg);
        doc.rect(box2Left, boxTop, boxWidth, boxHeight).strokeColor('#e2e8f0').stroke();

        doc.fillColor(mutedColor)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('LIVRAISON & PAIEMENT', box2Left + 12, boxTop + 10);

        const deliveryMode = (order as any).delivery?.mode || 'Transporteur propre';
        const driverInfo = (order as any).delivery?.driverName
          ? `${(order as any).delivery.driverName} (${(order as any).delivery.driverPhone || ''})`
          : 'Attribution après confirmation';

        doc.fillColor(secondaryColor)
          .fontSize(9)
          .font('Helvetica')
          .text(`Mode : ${deliveryMode}`, box2Left + 12, boxTop + 25)
          .text(`Chauffeur : ${driverInfo}`, box2Left + 12, boxTop + 40, { width: 220 })
          .text(`Paiement : ${order.paymentStatus}`, box2Left + 12, boxTop + 55)
          .text(`Notes : ${order.notes || 'Standard'}`, box2Left + 12, boxTop + 70, { width: 220 });

        // Table of Order Lines
        const tableTop = 230;
        doc.rect(40, tableTop, 515, 22).fill('#004322');

        doc.fillColor('#ffffff')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('Produit / Récolte', 50, tableTop + 6, { width: 170 })
          .text('Catégorie', 225, tableTop + 6, { width: 90 })
          .text('Quantité', 320, tableTop + 6, { width: 65, align: 'center' })
          .text('Prix Unit.', 390, tableTop + 6, { width: 75, align: 'right' })
          .text('Total', 470, tableTop + 6, { width: 75, align: 'right' });

        let currentY = tableTop + 22;
        const lines = order.lines || [];

        lines.forEach((line, idx) => {
          const isEven = idx % 2 === 0;
          if (isEven) {
            doc.rect(40, currentY, 515, 24).fill('#fbfcfd');
          }
          doc.rect(40, currentY, 515, 24).strokeColor('#edf2f7').stroke();

          const currencySymbol = order.currency || 'USD';
          const prodName = line.harvest?.product?.name || 'Produit récolté';
          const cat = line.harvest?.product?.category || 'MARAÎCHAGE';
          const qty = `${line.quantity} ${(line.harvest?.unit || 'kg').toLowerCase()}`;
          const unitPrice = `${Number(line.unitPrice).toLocaleString('fr-FR')} ${currencySymbol}`;
          const totalPrice = `${Number(line.totalPrice).toLocaleString('fr-FR')} ${currencySymbol}`;

          doc.fillColor(secondaryColor)
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(prodName, 50, currentY + 7, { width: 170 })
            .font('Helvetica')
            .fontSize(8)
            .fillColor(mutedColor)
            .text(cat, 225, currentY + 7, { width: 90 })
            .fillColor(secondaryColor)
            .fontSize(9)
            .text(qty, 320, currentY + 7, { width: 65, align: 'center' })
            .text(unitPrice, 390, currentY + 7, { width: 75, align: 'right' })
            .font('Helvetica-Bold')
            .fillColor(primaryColor)
            .text(totalPrice, 470, currentY + 7, { width: 75, align: 'right' });

          currentY += 24;
        });

        // Totals Box (with breakdown of subtotal + additional fees)
        currentY += 16;
        const totalBoxWidth = 240;
        const totalBoxLeft = 555 - totalBoxWidth;
        const orderCurrency = order.currency || 'USD';

        const cropsSubtotal = lines.reduce((sum, l) => sum + Number(l.totalPrice), 0);
        const feesList = order.fees || [];
        const totalBoxHeight = 44 + (feesList.length > 0 ? (feesList.length + 1) * 18 + 8 : 18);

        doc.rect(totalBoxLeft, currentY, totalBoxWidth, totalBoxHeight).fill(lightBg);
        doc.rect(totalBoxLeft, currentY, totalBoxWidth, totalBoxHeight).strokeColor('#e2e8f0').stroke();

        let summaryY = currentY + 10;

        // Subtotal
        doc.fillColor(secondaryColor)
          .fontSize(9)
          .font('Helvetica')
          .text('Sous-total récoltes :', totalBoxLeft + 12, summaryY)
          .font('Helvetica-Bold')
          .text(`${cropsSubtotal.toLocaleString('fr-FR')} ${orderCurrency}`, totalBoxLeft + 12, summaryY, {
            width: totalBoxWidth - 24,
            align: 'right',
          });
        summaryY += 18;

        // Additional fees itemization
        if (feesList.length > 0) {
          feesList.forEach((fee) => {
            doc.fillColor(mutedColor)
              .fontSize(8.5)
              .font('Helvetica')
              .text(fee.name, totalBoxLeft + 12, summaryY)
              .font('Helvetica')
              .fillColor(secondaryColor)
              .text(`${Number(fee.amount).toLocaleString('fr-FR')} ${orderCurrency}`, totalBoxLeft + 12, summaryY, {
                width: totalBoxWidth - 24,
                align: 'right',
              });
            summaryY += 18;
          });

          // Inner divider before grand total
          doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(totalBoxLeft + 10, summaryY).lineTo(totalBoxLeft + totalBoxWidth - 10, summaryY).stroke();
          summaryY += 6;
        }

        // Grand Total TTC
        const totalFormatted = `${Number(order.totalAmount).toLocaleString('fr-FR')} ${orderCurrency}`;
        doc.fillColor(primaryColor)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('Total commande TTC :', totalBoxLeft + 12, summaryY + 2);

        doc.fillColor(primaryColor)
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(totalFormatted, totalBoxLeft + 12, summaryY, {
            width: totalBoxWidth - 24,
            align: 'right',
          });

        // Footer
        doc.fontSize(8)
          .font('Helvetica')
          .fillColor(mutedColor)
          .text(
            'FutureFarm Logistics & Marketplace — Tous droits réservés. Document généré électroniquement et valable sans signature.',
            40,
            780,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async getOrderForUser(
    orderId: string,
    userId: string,
    permissions: Permission[],
  ): Promise<OrderEntity> {
    const order = await this.getOrder(orderId);
    const isAdmin = permissions.includes(Permission.ORDER_READ_ALL);
    const isBuyer = order.buyerId === userId;

    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    const isSeller =
      farmerProfile &&
      order.lines.some((l) => l.farmerProfileId === farmerProfile.id);

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new ForbiddenException(
        'You are not authorized to view this order',
      );
    }

    return order;
  }

  async reconcileBuyerOrdersBackground(buyerId: string): Promise<void> {
    try {
      const pendingOrders = await this.orderRepository.find({
        where: [
          { buyerId, status: OrderStatus.PENDING_PAYMENT },
          { buyerId, paymentStatus: PaymentStatus.PENDING },
        ],
      });

      if (pendingOrders.length === 0) return;

      const paymentRecordRepo = this.dataSource.getRepository(PaymentRecordEntity);
      for (const order of pendingOrders) {
        const paymentRecords = await paymentRecordRepo.find({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
        });

        for (const pr of paymentRecords) {
          try {
            await this.confirmPayment(pr.gatewayRef);
          } catch (err: any) {
            // Log as debug/warn since payment may genuinely still be pending
            this.logger.debug(
              `Background payment check for order ${order.id} (${pr.gatewayRef}): ${err?.message || err}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to run background payment reconciliation for buyer ${buyerId}: ${err?.message || err}`,
      );
    }
  }

  async listMyOrders(buyerId: string): Promise<OrderEntity[]> {
    // Trigger non-blocking asynchronous reconciliation without adding latency to the response
    setImmediate(() => {
      void this.reconcileBuyerOrdersBackground(buyerId);
    });

    return this.orderRepository.find({
      where: { buyerId },
      relations: ['lines', 'lines.harvest', 'lines.harvest.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async listFarmerOrderLines(userId: string): Promise<OrderLineEntity[]> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User is not a farmer');
    }

    return this.orderLineRepository.find({
      where: { farmerProfileId: farmerProfile.id },
      relations: ['order', 'harvest', 'harvest.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async listAllOrdersAdmin(options: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<OrderEntity>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.orderRepository.findAndCount({
      relations: [
        'lines',
        'lines.harvest',
        'lines.harvest.product',
        'lines.farmerProfile',
        'lines.farmerProfile.user',
        'buyer',
      ],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}
