import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  CheckoutDto,
  RejectOrderLineDto,
  PaginatedResult,
  Permission,
  NotificationChannel,
} from '@futurefarm/types';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { PaymentRecordEntity } from './entities/payment-record.entity';
import { BasketEntity } from './entities/basket.entity';
import { BasketStatus } from './entities/basket-status.enum';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { BidEntity } from '../auctions/entities/bid.entity';
import { AuctionEntity } from '../auctions/entities/auction.entity';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_GATEWAY_PORT, PaymentGatewayPort } from './interfaces/payment-gateway.port';

@Injectable()
export class OrdersService {
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
      const order = new OrderEntity();
      order.buyerId = buyerId;
      order.status = OrderStatus.PENDING_PAYMENT;
      order.paymentStatus = PaymentStatus.PENDING;
      order.deliveryAddress = dto.deliveryAddress;
      order.notes = dto.notes ?? null;
      order.totalAmount = 0;
      order.cancellationFee = 0;

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
        const unitPrice = priceDetails.decayedPrice;
        const lineTotal = Number((line.quantity * unitPrice).toFixed(2));

        const orderLine = new OrderLineEntity();
        orderLine.orderId = savedOrder.id;
        orderLine.harvestId = harvest.id;
        orderLine.farmerProfileId = harvest.farmerProfileId;
        orderLine.quantity = line.quantity;
        orderLine.unitPrice = unitPrice;
        orderLine.totalPrice = lineTotal;
        orderLine.status = OrderLineStatus.PENDING;

        const savedLine = await manager.save(OrderLineEntity, orderLine);
        lines.push(savedLine);
        totalAmount += lineTotal;
      }

      savedOrder.totalAmount = Number(totalAmount.toFixed(2));
      savedOrder.lines = lines;
      const finalOrder = await manager.save(OrderEntity, savedOrder);

      // Archive/Abandoned active basket
      basket.status = BasketStatus.ABANDONED;
      await manager.save(BasketEntity, basket);

      // Call payment gateway
      const paymentResult = await this.paymentGateway.initiatePayment(finalOrder, finalOrder.totalAmount);

      const paymentRecord = new PaymentRecordEntity();
      paymentRecord.orderId = finalOrder.id;
      paymentRecord.gatewayRef = paymentResult.gatewayRef;
      paymentRecord.amount = finalOrder.totalAmount;
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

      const response: { order: OrderEntity; paymentUrl?: string } = {
        order: finalOrder,
      };
      if (paymentResult.paymentUrl) {
        response.paymentUrl = paymentResult.paymentUrl;
      }
      return response;
    });
  }

  async confirmPayment(paymentRef: string): Promise<OrderEntity> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const paymentRecord = await manager.findOne(PaymentRecordEntity, {
        where: { gatewayRef: paymentRef },
        relations: ['order', 'order.lines'],
      });

      if (!paymentRecord) {
        throw new NotFoundException('Payment record not found');
      }

      if (paymentRecord.status !== PaymentStatus.PENDING) {
        return paymentRecord.order;
      }

      const gatewayConfirm = await this.paymentGateway.confirmPayment(paymentRef);
      if (!gatewayConfirm.success) {
        throw new BadRequestException('Payment confirmation failed at gateway');
      }

      paymentRecord.status = PaymentStatus.PAID;
      paymentRecord.metadata = {
        ...paymentRecord.metadata,
        ...gatewayConfirm.metadata,
      };
      await manager.save(PaymentRecordEntity, paymentRecord);

      const order = paymentRecord.order;
      order.paymentStatus = PaymentStatus.PAID;
      order.status = OrderStatus.AWAITING_CONFIRMATION;
      const savedOrder = await manager.save(OrderEntity, order);

      // Notify buyer
      await this.notificationsService.send({
        recipientIds: [order.buyerId],
        title: 'Payment Confirmed',
        body: `Payment for order #${order.id.slice(0, 8)} has been confirmed. Farmers have been notified.`,
        channels: [NotificationChannel.DATABASE],
      });

      // Notify each farmer
      const farmerIds = Array.from(new Set(order.lines.map((l) => l.farmerProfileId)));
      for (const farmerProfileId of farmerIds) {
        const farmer = await manager.findOne(FarmerProfileEntity, {
          where: { id: farmerProfileId },
        });
        if (farmer) {
          await this.notificationsService.send({
            recipientIds: [farmer.userId],
            title: 'New Sale Order',
            body: `You have order items awaiting confirmation in order #${order.id.slice(0, 8)}.`,
            channels: [NotificationChannel.DATABASE],
          });
        }
      }

      return savedOrder;
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

      return manager.save(OrderEntity, order);
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
  ): Promise<OrderEntity> {
    // Check stock reduction is already done by the auction system creating the auction,
    // so here we don't deduct stock again. We just map the bid and won lot to the Order entities.

    const order = new OrderEntity();
    order.buyerId = bid.buyerId;
    order.status = OrderStatus.AWAITING_CONFIRMATION;
    order.paymentStatus = PaymentStatus.PAID;
    order.totalAmount = Number(bid.priceAtBid) * Number(bid.quantityWon);
    order.cancellationFee = 0;
    order.deliveryAddress = {
      street: 'Auction Depot Lot',
      city: 'System Depot',
      country: 'System',
      postalCode: '00000',
    };
    order.notes = `Won via Auction Lot #${auction.id.slice(0, 8)}`;
    order.auctionBidId = bid.id;

    const savedOrder = await manager.save(OrderEntity, order);

    const orderLine = new OrderLineEntity();
    orderLine.orderId = savedOrder.id;
    orderLine.harvestId = auction.harvestId;
    orderLine.farmerProfileId = auction.farmerProfileId;
    orderLine.quantity = bid.quantityWon;
    orderLine.unitPrice = bid.priceAtBid;
    orderLine.totalPrice = order.totalAmount;
    orderLine.status = OrderLineStatus.CONFIRMED; // Auction lists are pre-confirmed

    await manager.save(OrderLineEntity, orderLine);

    const paymentRecord = new PaymentRecordEntity();
    paymentRecord.orderId = savedOrder.id;
    paymentRecord.gatewayRef = `auction-bid-payment-${bid.id}`;
    paymentRecord.amount = order.totalAmount;
    paymentRecord.status = PaymentStatus.PAID;
    paymentRecord.metadata = { wonAt: new Date().toISOString() };
    await manager.save(PaymentRecordEntity, paymentRecord);

    return savedOrder;
  }

  // =============================================================================
  // Queries
  // =============================================================================

  async getOrder(orderId: string): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['lines', 'lines.harvest', 'lines.harvest.product', 'buyer'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
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

  async listMyOrders(buyerId: string): Promise<OrderEntity[]> {
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
      relations: ['lines', 'lines.harvest', 'lines.harvest.product', 'buyer'],
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
