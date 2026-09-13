import { CompositePaymentGateway } from './composite-payment.adapter';
import { OrderEntity } from '../entities/order.entity';
import { PaymentStatus } from '@futurefarm/types';

describe('CompositePaymentGateway', () => {
  let composite: CompositePaymentGateway;
  let mockStripe: any;
  let mockPawaPay: any;
  let mockMock: any;
  let mockConfig: any;

  beforeEach(() => {
    mockStripe = {
      initiatePayment: jest.fn().mockResolvedValue({
        gatewayRef: 'cs_test_123',
        paymentUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        status: PaymentStatus.PENDING,
      }),
      confirmPayment: jest.fn().mockResolvedValue({ success: true, gatewayRef: 'cs_test_123' }),
      refundPayment: jest.fn().mockResolvedValue(undefined),
    };

    mockPawaPay = {
      initiatePayment: jest.fn().mockResolvedValue({
        gatewayRef: 'pawapay_123',
        paymentUrl: 'https://checkout.sandbox.pawapay.io/123',
        status: PaymentStatus.PENDING,
      }),
      confirmPayment: jest.fn().mockResolvedValue({ success: true, gatewayRef: 'pawapay_123' }),
      refundPayment: jest.fn().mockResolvedValue(undefined),
    };

    mockMock = {
      initiatePayment: jest.fn().mockResolvedValue({
        gatewayRef: 'mock-123',
        status: PaymentStatus.PENDING,
      }),
      confirmPayment: jest.fn().mockResolvedValue({ success: true, gatewayRef: 'mock-123' }),
      refundPayment: jest.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      get: jest.fn().mockReturnValue('mock'),
    };

    composite = new CompositePaymentGateway(mockStripe, mockPawaPay, mockMock, mockConfig);
  });

  describe('initiatePayment routing', () => {
    const order = { id: 'ord-1' } as OrderEntity;

    it('routes to Stripe when paymentMethod is stripe', async () => {
      await composite.initiatePayment(order, 100, { paymentMethod: 'stripe' });
      expect(mockStripe.initiatePayment).toHaveBeenCalledWith(order, 100, { paymentMethod: 'stripe' });
      expect(mockPawaPay.initiatePayment).not.toHaveBeenCalled();
    });

    it('routes to Stripe when paymentMethod is card', async () => {
      await composite.initiatePayment(order, 100, { paymentMethod: 'card' });
      expect(mockStripe.initiatePayment).toHaveBeenCalledWith(order, 100, { paymentMethod: 'card' });
    });

    it('routes to PawaPay when paymentMethod is mobile_money', async () => {
      await composite.initiatePayment(order, 100, {
        paymentMethod: 'mobile_money',
        phoneNumber: '+221770000000',
      });
      expect(mockPawaPay.initiatePayment).toHaveBeenCalledWith(order, 100, {
        paymentMethod: 'mobile_money',
        phoneNumber: '+221770000000',
      });
      expect(mockStripe.initiatePayment).not.toHaveBeenCalled();
    });

    it('falls back to mockGateway when no method provided and config is mock', async () => {
      await composite.initiatePayment(order, 100);
      expect(mockMock.initiatePayment).toHaveBeenCalledWith(order, 100, undefined);
    });
  });

  describe('confirmPayment routing', () => {
    it('routes cs_ references directly to Stripe', async () => {
      await composite.confirmPayment('cs_test_session');
      expect(mockStripe.confirmPayment).toHaveBeenCalledWith('cs_test_session');
      expect(mockPawaPay.confirmPayment).not.toHaveBeenCalled();
    });

    it('routes pi_ references directly to Stripe', async () => {
      await composite.confirmPayment('pi_test_intent_123');
      expect(mockStripe.confirmPayment).toHaveBeenCalledWith('pi_test_intent_123');
      expect(mockPawaPay.confirmPayment).not.toHaveBeenCalled();
    });

    it('routes mock- references directly to Mock', async () => {
      await composite.confirmPayment('mock-ref-123');
      expect(mockMock.confirmPayment).toHaveBeenCalledWith('mock-ref-123');
      expect(mockPawaPay.confirmPayment).not.toHaveBeenCalled();
    });

    it('routes PawaPay references to PawaPay gateway', async () => {
      await composite.confirmPayment('pawapay_checkout_id');
      expect(mockPawaPay.confirmPayment).toHaveBeenCalledWith('pawapay_checkout_id');
    });
  });

  describe('refundPayment routing', () => {
    it('routes cs_ references directly to Stripe refund', async () => {
      await composite.refundPayment('cs_test_session', 50);
      expect(mockStripe.refundPayment).toHaveBeenCalledWith('cs_test_session', 50);
    });

    it('routes pi_ references directly to Stripe refund', async () => {
      await composite.refundPayment('pi_test_intent_123', 50);
      expect(mockStripe.refundPayment).toHaveBeenCalledWith('pi_test_intent_123', 50);
    });

    it('routes mock- references directly to Mock refund', async () => {
      await composite.refundPayment('mock-ref-123', 50);
      expect(mockMock.refundPayment).toHaveBeenCalledWith('mock-ref-123', 50);
    });

    it('routes other references to PawaPay refund', async () => {
      await composite.refundPayment('pawapay_deposit_id', 50);
      expect(mockPawaPay.refundPayment).toHaveBeenCalledWith('pawapay_deposit_id', 50);
    });
  });
});
