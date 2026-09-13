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
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_123',
          status: 'succeeded',
          amount_received: 10000,
        }),
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
          provider: 'stripe',
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

    it('should retrieve payment intent directly for pi_ references and confirm payment status', async () => {
      const result = await gateway.confirmPayment('pi_123');

      expect(result).toEqual({
        success: true,
        pending: false,
        gatewayRef: 'pi_123',
        metadata: {
          paymentIntentId: 'pi_123',
          status: 'succeeded',
          amountReceived: 10000,
        },
      });
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
    });
  });

  describe('createSetupCheckoutSession', () => {
    it('should create a setup checkout session and return session URL', async () => {
      const result = await gateway.createSetupCheckoutSession({
        customerId: 'cus_123',
        successUrl: 'http://localhost:3001/auctions/auc-1',
        cancelUrl: 'http://localhost:3001/auctions/auc-1',
        userId: 'user-1',
      });

      expect(result).toEqual({
        sessionId: 'sess_123',
        sessionUrl: 'https://checkout.stripe.com/pay/sess_123',
      });
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith({
        mode: 'setup',
        customer: 'cus_123',
        payment_method_types: ['card'],
        success_url: 'http://localhost:3001/auctions/auc-1?setup_session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3001/auctions/auc-1',
        client_reference_id: 'user-1',
        metadata: {
          userId: 'user-1',
          purpose: 'save_card',
        },
      });
    });
  });

  describe('confirmSetupCheckoutSession', () => {
    it('should retrieve setup checkout session and return payment method info', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValueOnce({
        id: 'sess_setup_123',
        customer: 'cus_123',
        setup_intent: {
          id: 'seti_123',
          payment_method: {
            id: 'pm_123',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2030,
            },
          },
        },
      });
      mockStripeInstance.customers = {
        update: jest.fn().mockResolvedValue({}),
      };

      const result = await gateway.confirmSetupCheckoutSession('sess_setup_123');

      expect(result).toEqual({
        paymentMethodId: 'pm_123',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2030,
        customerId: 'cus_123',
        userId: undefined,
      });
      expect(mockStripeInstance.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: {
          default_payment_method: 'pm_123',
        },
      });
    });
  });
});
