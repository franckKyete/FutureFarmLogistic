/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  HarvestStatus,
  Permission,
} from '@futurefarm/types';
import { OrdersService } from './orders.service';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { PaymentRecordEntity } from './entities/payment-record.entity';
import { BasketEntity } from './entities/basket.entity';
import { BasketLineEntity } from './entities/basket-line.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { UserEntity } from '../users/entities/user.entity';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_GATEWAY_PORT } from './interfaces/payment-gateway.port';

describe('OrdersService', () => {
  let service: OrdersService;
  let farmerProfileRepo: any;
  let orderRepo: any;
  let orderLineRepo: any;

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn((entityOrClass: any, maybeEntity?: any) => {
      const entity = maybeEntity ?? entityOrClass;
      return Promise.resolve({ id: 'saved-id', ...entity });
    }),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((modeOrCb: any, cb?: any) => {
      const actualCb = typeof modeOrCb === 'function' ? modeOrCb : cb;
      return actualCb(mockEntityManager);
    }),
  };

  const mockPaymentGateway = {
    initiatePayment: jest.fn(() =>
      Promise.resolve({
        gatewayRef: 'mock-gateway-ref',
        status: PaymentStatus.PENDING,
      }),
    ),
    confirmPayment: jest.fn(() =>
      Promise.resolve({
        success: true,
        gatewayRef: 'mock-gateway-ref',
      }),
    ),
    refundPayment: jest.fn(() => Promise.resolve()),
  };

  const mockProductsService = {
    getDecayedPrice: jest.fn(() =>
      Promise.resolve({
        basePrice: 10,
        decayedPrice: 10,
        multiplier: 1.0,
      }),
    ),
  };

  const mockNotificationsService = {
    send: jest.fn(() => Promise.resolve()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: { findOne: jest.fn(), find: jest.fn(), findAndCount: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(OrderLineEntity),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PaymentRecordEntity),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(BasketEntity),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(BasketLineEntity),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(HarvestEntity),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FarmerProfileEntity),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: { existsBy: jest.fn() },
        },
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: PAYMENT_GATEWAY_PORT,
          useValue: mockPaymentGateway,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    farmerProfileRepo = module.get(getRepositoryToken(FarmerProfileEntity));
    orderRepo = module.get(getRepositoryToken(OrderEntity));
    orderLineRepo = module.get(getRepositoryToken(OrderLineEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkout', () => {
    it('should create order and initiate payment successfully', async () => {
      const mockBasket = {
        id: 'basket-1',
        buyerId: 'buyer-1',
        status: 'ACTIVE',
        lines: [{ id: 'line-1', harvestId: 'harvest-1', quantity: 5 }],
      };
      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === BasketEntity) return Promise.resolve(mockBasket);
        if (entityClass === HarvestEntity) {
          return Promise.resolve({
            id: 'harvest-1',
            status: HarvestStatus.APPROVED,
            quantityInStock: 100,
            stockMarge: 10,
            farmerProfileId: 'farmer-1',
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.checkout('buyer-1', {
        deliveryAddress: {
          street: '123 Farm Road',
          city: 'Agri',
          country: 'MA',
          postalCode: '100',
        },
      });

      expect(result).toBeDefined();
      expect(mockEntityManager.save).toHaveBeenCalled();
      expect(mockPaymentGateway.initiatePayment).toHaveBeenCalled();
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException if basket is empty', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);

      await expect(
        service.checkout('buyer-1', {
          deliveryAddress: {
            street: '123 Farm Road',
            city: 'Agri',
            country: 'MA',
            postalCode: '100',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and update statuses', async () => {
      const mockPaymentRecord = {
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        gatewayRef: 'ref-1',
        order: {
          id: 'order-1',
          buyerId: 'buyer-1',
          lines: [{ farmerProfileId: 'farmer-1' }],
        },
      };

      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === PaymentRecordEntity) return Promise.resolve(mockPaymentRecord);
        if (entityClass === FarmerProfileEntity) return Promise.resolve({ userId: 'farmer-user-1' });
        return Promise.resolve(null);
      });

      const result = await service.confirmPayment('ref-1');
      expect(result).toBeDefined();
      expect(mockPaymentGateway.confirmPayment).toHaveBeenCalledWith('ref-1');
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });
  });

  describe('confirmOrderLine', () => {
    it('should allow farmer to confirm order line', async () => {
      farmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1', userId: 'farmer-user-1' });

      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === OrderEntity) {
          return Promise.resolve({
            id: 'order-1',
            status: OrderStatus.AWAITING_CONFIRMATION,
            buyerId: 'buyer-1',
          });
        }
        if (entityClass === OrderLineEntity) {
          return Promise.resolve({
            id: 'line-1',
            farmerProfileId: 'farmer-1',
            status: OrderLineStatus.PENDING,
          });
        }
        return Promise.resolve(null);
      });

      mockEntityManager.find.mockResolvedValue([
        { id: 'line-1', status: OrderLineStatus.CONFIRMED },
      ]);

      const result = await service.confirmOrderLine('farmer-user-1', 'order-1', 'line-1');
      expect(result.status).toBe(OrderLineStatus.CONFIRMED);
      expect(mockEntityManager.save).toHaveBeenCalled();
    });
  });

  describe('rejectOrderLine', () => {
    it('should fail if user is not a farmer', async () => {
      farmerProfileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.rejectOrderLine('buyer-user-1', 'order-1', 'line-1', { reason: 'No stock' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject order line, refund stock, and trigger partial payment refund', async () => {
      farmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1', userId: 'farmer-user-1' });

      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === OrderEntity) {
          return Promise.resolve({
            id: 'order-1',
            status: OrderStatus.AWAITING_CONFIRMATION,
            buyerId: 'buyer-1',
          });
        }
        if (entityClass === OrderLineEntity) {
          return Promise.resolve({
            id: 'line-1',
            farmerProfileId: 'farmer-1',
            status: OrderLineStatus.PENDING,
            quantity: 5,
            totalPrice: 50,
            harvest: { id: 'harvest-1', quantityInStock: 20 },
          });
        }
        if (entityClass === PaymentRecordEntity) {
          return Promise.resolve({
            id: 'pay-1',
            gatewayRef: 'ref-1',
            status: PaymentStatus.PAID,
          });
        }
        return Promise.resolve(null);
      });

      mockEntityManager.find.mockResolvedValue([
        { id: 'line-1', status: OrderLineStatus.REJECTED },
      ]);

      const result = await service.rejectOrderLine('farmer-user-1', 'order-1', 'line-1', { reason: 'Damaged' });
      expect(result.status).toBe(OrderLineStatus.REJECTED);
      expect(mockPaymentGateway.refundPayment).toHaveBeenCalledWith('ref-1', 50);
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });
  });

  describe('shipOrderLines', () => {
    it('should fail if user is not a farmer', async () => {
      farmerProfileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.shipOrderLines('buyer-user-1', 'order-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should mark farmer confirmed lines as shipped', async () => {
      farmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1', userId: 'farmer-user-1' });

      mockEntityManager.findOne.mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        lines: [
          { id: 'line-1', farmerProfileId: 'farmer-1', status: OrderLineStatus.CONFIRMED },
        ],
      });

      mockEntityManager.find.mockResolvedValue([
        { id: 'line-1', farmerProfileId: 'farmer-1', status: OrderLineStatus.SHIPPED },
      ]);

      const result = await service.shipOrderLines('farmer-user-1', 'order-1');
      expect(result.length).toBe(1);
      expect(result[0]!.status).toBe(OrderLineStatus.SHIPPED);
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });
  });

  describe('deliverOrderLines', () => {
    it('should fail if user is not a farmer', async () => {
      farmerProfileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deliverOrderLines('buyer-user-1', 'order-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should mark shipped lines as delivered and trigger order auto-completion', async () => {
      farmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1', userId: 'farmer-user-1' });

      mockEntityManager.findOne.mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        lines: [
          { id: 'line-1', farmerProfileId: 'farmer-1', status: OrderLineStatus.SHIPPED },
        ],
      });

      mockEntityManager.find.mockResolvedValue([
        { id: 'line-1', farmerProfileId: 'farmer-1', status: OrderLineStatus.DELIVERED },
      ]);

      const result = await service.deliverOrderLines('farmer-user-1', 'order-1');
      expect(result.length).toBe(1);
      expect(result[0]!.status).toBe(OrderLineStatus.DELIVERED);
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('should throw ForbiddenException if user cancels someone else\'s order', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-2',
      });

      await expect(service.cancelOrder('buyer-1', 'order-1')).rejects.toThrow(ForbiddenException);
    });

    it('should cancel order and refund payment (with 10% fee if status is CONFIRMED)', async () => {
      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === OrderEntity) {
          return Promise.resolve({
            id: 'order-1',
            buyerId: 'buyer-1',
            status: OrderStatus.CONFIRMED,
            totalAmount: 100,
            paymentStatus: PaymentStatus.PAID,
            lines: [
              { id: 'line-1', quantity: 5, status: OrderLineStatus.CONFIRMED, harvest: { quantityInStock: 10 } },
            ],
          });
        }
        if (entityClass === PaymentRecordEntity) {
          return Promise.resolve({
            id: 'pay-1',
            gatewayRef: 'ref-1',
            status: PaymentStatus.PAID,
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.cancelOrder('buyer-1', 'order-1');
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.cancellationFee).toBe(10); // 10% of 100
      expect(mockPaymentGateway.refundPayment).toHaveBeenCalledWith('ref-1', 90);
    });
  });

  describe('cancelOrderForce', () => {
    it('should force cancel order, refund full payment and refund stock', async () => {
      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === OrderEntity) {
          return Promise.resolve({
            id: 'order-1',
            totalAmount: 100,
            paymentStatus: PaymentStatus.PAID,
            lines: [
              { id: 'line-1', quantity: 5, status: OrderLineStatus.CONFIRMED, harvest: { quantityInStock: 10 } },
            ],
          });
        }
        if (entityClass === PaymentRecordEntity) {
          return Promise.resolve({
            id: 'pay-1',
            gatewayRef: 'ref-1',
            status: PaymentStatus.PAID,
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.cancelOrderForce('order-1');
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockPaymentGateway.refundPayment).toHaveBeenCalledWith('ref-1', 100);
    });
  });

  describe('refundOrderManual', () => {
    it('should manually refund PAID orders without changing order status', async () => {
      mockEntityManager.findOne.mockImplementation((entityClass) => {
        if (entityClass === OrderEntity) {
          return Promise.resolve({
            id: 'order-1',
            totalAmount: 100,
            paymentStatus: PaymentStatus.PAID,
          });
        }
        if (entityClass === PaymentRecordEntity) {
          return Promise.resolve({
            id: 'pay-1',
            gatewayRef: 'ref-1',
            status: PaymentStatus.PAID,
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.refundOrderManual('order-1');
      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(mockPaymentGateway.refundPayment).toHaveBeenCalledWith('ref-1', 100);
    });
  });

  describe('overrideFee', () => {
    it('should override the cancellation fee', async () => {
      const mockOrder = { id: 'order-1', cancellationFee: 10 };
      orderRepo.findOne.mockResolvedValue(mockOrder);
      orderRepo.save.mockResolvedValue({ ...mockOrder, cancellationFee: 20 });

      const result = await service.overrideFee('order-1', 20);
      expect(result.cancellationFee).toBe(20);
    });
  });

  describe('createFromBid', () => {
    it('should create order, line, and payment record from bid successfully', async () => {
      const mockBid = { id: 'bid-1', buyerId: 'buyer-1', priceAtBid: 15, quantityWon: 4 };
      const mockAuction = { id: 'auc-1', harvestId: 'har-1', farmerProfileId: 'farmer-1' };

      const result = await service.createFromBid(mockBid as any, mockAuction as any, mockEntityManager);
      expect(result).toBeDefined();
      expect(result.totalAmount).toBe(60);
      expect(mockEntityManager.save).toHaveBeenCalledTimes(3); // Order, OrderLine, PaymentRecord
    });
  });

  describe('Queries', () => {
    it('should get order by id', async () => {
      const mockOrder = { id: 'order-1', lines: [] };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-1');
      expect(result.id).toBe('order-1');
    });

    it('should authorize buyer/seller/admin for getOrderForUser', async () => {
      const mockOrder = { id: 'order-1', buyerId: 'buyer-1', lines: [{ farmerProfileId: 'farmer-1' }] };
      orderRepo.findOne.mockResolvedValue(mockOrder);
      farmerProfileRepo.findOne.mockImplementation(({ where }: any) => {
        if (where && where.userId === 'farmer-user-1') {
          return Promise.resolve({ id: 'farmer-1' });
        }
        return Promise.resolve(null);
      });

      // Seller access
      await expect(service.getOrderForUser('order-1', 'farmer-user-1', [Permission.ORDER_READ])).resolves.toBeDefined();

      // Buyer access
      await expect(service.getOrderForUser('order-1', 'buyer-1', [Permission.ORDER_READ])).resolves.toBeDefined();

      // Admin access
      await expect(service.getOrderForUser('order-1', 'admin-1', [Permission.ORDER_READ_ALL])).resolves.toBeDefined();

      // Unauthorized access
      await expect(service.getOrderForUser('order-1', 'unauth-1', [Permission.ORDER_READ])).rejects.toThrow(ForbiddenException);
    });

    it('should list farmer order lines', async () => {
      farmerProfileRepo.findOne.mockResolvedValue({ id: 'farmer-1' });
      orderLineRepo.find.mockResolvedValue([{ id: 'line-1', farmerProfileId: 'farmer-1' }]);

      const result = await service.listFarmerOrderLines('farmer-user-1');
      expect(result.length).toBe(1);
    });

    it('should list my orders', async () => {
      orderRepo.find.mockResolvedValue([{ id: 'order-1' }]);
      const result = await service.listMyOrders('buyer-1');
      expect(result.length).toBe(1);
    });

    it('should list all orders for admin with pagination', async () => {
      orderRepo.findAndCount.mockResolvedValue([[{ id: 'order-1' }], 1]);
      const result = await service.listAllOrdersAdmin({});
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
