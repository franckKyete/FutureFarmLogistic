import { StripePaymentGateway } from './stripe.adapter';
import { OrderEntity } from '../entities/order.entity';
import { PaymentStatus } from '@futurefarm/types';
import Stripe from 'stripe';

jest.mock('stripe');

describe('StripePaymentGateway', () => {
  let gateway: StripePaymentGateway;
  let configService: any;
  let mockStripeInstance: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
        if (key === 'STRIPE_CURRENCY') return 'usd';
        if (key === 'CORS_ORIGINS') return 'http://localhost:3001';
        return def;
      }),
    };

    mockStripeInstance = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'sess_123',
            url: 'https://checkout.stripe.com/pay/sess_123',
            payment_status: 'unpaid',
            status: 'open',
            payment_intent: 'pi_123',
          }),
          retrieve: jest.fn().mockResolvedValue({
            id: 'sess_123',
            payment_status: 'paid',
            status: 'complete',
            payment_intent: 'pi_123',
          }),
        },
      },
      refunds: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    (Stripe as any).mockImplementation(() => mockStripeInstance);

    gateway = new StripePaymentGateway(configService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should create a checkout session and return PaymentInitResult', async () => {
      const order = { id: 'order-123' } as OrderEntity;
      const result = await gateway.initiatePayment(order, 100);

      expect(result).toEqual({
        gatewayRef: 'sess_123',
        paymentUrl: 'https://checkout.stripe.com/pay/sess_123',
        status: PaymentStatus.PENDING,
        metadata: {
          stripeSessionId: 'sess_123',
          paymentIntentId: 'pi_123',
        },
      });
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'FutureFarm Order #order-12',
                description: 'Payment for crop harvests',
              },
              unit_amount: 10000,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'http://localhost:3001/orders?session_id={CHECKOUT_SESSION_ID}&order_id=order-123',
        cancel_url: 'http://localhost:3001/checkout',
        client_reference_id: 'order-123',
      });
    });
  });

  describe('confirmPayment', () => {
    it('should retrieve checkout session and confirm payment status', async () => {
      const result = await gateway.confirmPayment('sess_123');

      expect(result).toEqual({
        success: true,
        gatewayRef: 'sess_123',
        metadata: {
          paymentStatus: 'paid',
          status: 'complete',
          paymentIntentId: 'pi_123',
        },
      });
      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('sess_123');
    });
  });

  describe('refundPayment', () => {
    it('should create a refund for the associated payment intent', async () => {
      await gateway.refundPayment('sess_123', 50);

      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('sess_123');
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 5000,
      });
    });
  });
});
