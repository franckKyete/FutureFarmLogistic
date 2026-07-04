/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  OrderLineStatus,
  PaymentStatus,
  HarvestStatus,
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
});
