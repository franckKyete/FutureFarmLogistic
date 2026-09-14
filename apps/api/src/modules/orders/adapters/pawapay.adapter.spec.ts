import { PawaPayPaymentGateway } from './pawapay.adapter';
import { OrderEntity } from '../entities/order.entity';
import { PaymentStatus } from '@futurefarm/types';

describe('PawaPayPaymentGateway', () => {
  let gateway: PawaPayPaymentGateway;
  let configService: any;
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    configService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'PAWAPAY_API_TOKEN') return 'mock-token-xyz';
        if (key === 'PAWAPAY_BASE_URL') return 'https://api.sandbox.pawapay.io';
        if (key === 'PAWAPAY_CURRENCY') return 'XOF';
        if (key === 'PAWAPAY_COUNTRY') return 'SEN';
        if (key === 'CORS_ORIGINS') return 'http://localhost:3001';
        return def;
      }),
    };

    gateway = new PawaPayPaymentGateway(configService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should initiate a checkout session and return redirect URL', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_123',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_123',
          checkoutCode: 'code_123',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-uuid-1', buyerId: 'buyer-uuid-1' } as OrderEntity;
      const result = await gateway.initiatePayment(order, 5000, {
        phoneNumber: '+221 77 123 45 67',
        mmoProvider: 'ORANGE_SEN',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sandbox.pawapay.io/v2/checkouts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-xyz',
            'Content-Type': 'application/json',
          }),
        }),
      );

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.amounts[0].amount).toBe('5000');
      expect(sentBody.amounts[0].currency).toBe('XOF');
      expect(sentBody.payer.accountDetails.phoneNumber).toBe('221771234567');
      expect(sentBody.payer.accountDetails.provider).toBe('ORANGE_SEN');

      expect(result.paymentUrl).toBe('https://checkout.sandbox.pawapay.io/ch_123');
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should use dynamic clientOrigin for returnUrl when provided', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_lan_123',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_lan_123',
          checkoutCode: 'code_lan_123',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-lan-pawa', buyerId: 'buyer-uuid-1' } as OrderEntity;
      await gateway.initiatePayment(order, 5000, {
        clientOrigin: 'http://192.168.24.178:3001',
      });

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.returnUrl).toContain('https://192.168.24.178:3001/orders');
      expect(sentBody.returnUrl).toContain('orderId=order-lan-pawa');
      expect(sentBody.returnUrl).toContain('provider=pawapay');
    });

    it('should round UP float amounts to next whole integer using Math.ceil', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_ceil_test',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_ceil_test',
          checkoutCode: 'code_ceil_test',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-ceil-1', buyerId: 'buyer-ceil-1' } as OrderEntity;
      const result = await gateway.initiatePayment(order, 10.01);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.amounts[0].amount).toBe('11');
      expect(result.metadata?.chargedAmount).toBe(11);
      expect(result.metadata?.originalAmount).toBe(10.01);
    });

    it('should throw BadRequestException when token is not defined', async () => {
      configService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'PAWAPAY_API_TOKEN') return '';
        return def;
      });
      const unconfigGateway = new PawaPayPaymentGateway(configService);

      const order = { id: 'order-sim-1', buyerId: 'buyer-sim-1' } as OrderEntity;
      await expect(unconfigGateway.initiatePayment(order, 2500)).rejects.toThrow(
        'PawaPay API token is not configured',
      );
    });

    it('should omit payer when phoneNumber is not specified', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_no_phone',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_no_phone',
          checkoutCode: 'code_no_phone',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-uuid-2', buyerId: 'buyer-uuid-2' } as OrderEntity;
      const result = await gateway.initiatePayment(order, 7500);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.payer).toBeUndefined();
      expect(sentBody.reason).toEqual({ fr: 'Commande FutureFarm' });
      expect(result.paymentUrl).toBe('https://checkout.sandbox.pawapay.io/ch_no_phone');
    });

    it('should sanitize baseUrl ending with /v2 and not produce /v2/v2/checkouts', async () => {
      configService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'PAWAPAY_API_TOKEN') return 'mock-token-xyz';
        if (key === 'PAWAPAY_BASE_URL') return 'https://api.sandbox.pawapay.io/v2';
        if (key === 'PAWAPAY_CURRENCY') return 'XOF';
        if (key === 'PAWAPAY_COUNTRY') return 'SEN';
        return def;
      });
      const v2Gateway = new PawaPayPaymentGateway(configService);
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_v2_test',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_v2_test',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-v2', buyerId: 'buyer-v2' } as OrderEntity;
      await v2Gateway.initiatePayment(order, 3000);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sandbox.pawapay.io/v2/checkouts',
        expect.anything(),
      );
    });

    it('should attach RFC-9421 HTTP signature headers when PAWAPAY_PRIVATE_KEY is provided', async () => {
      const { generateKeyPairSync } = require('crypto');
      const { privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        privateKeyEncoding: { type: 'sec1', format: 'pem' },
      });

      configService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'PAWAPAY_API_TOKEN') return 'mock-token-xyz';
        if (key === 'PAWAPAY_BASE_URL') return 'https://api.sandbox.pawapay.io';
        if (key === 'PAWAPAY_PRIVATE_KEY') return privateKey;
        if (key === 'PAWAPAY_KEY_ID') return 'test-key-id';
        if (key === 'PAWAPAY_CURRENCY') return 'XOF';
        if (key === 'PAWAPAY_COUNTRY') return 'SEN';
        return def;
      });

      const signedGateway = new PawaPayPaymentGateway(configService);
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          checkoutId: 'ch_signed',
          redirectUrl: 'https://checkout.sandbox.pawapay.io/ch_signed',
          status: 'ACCEPTED',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const order = { id: 'order-signed', buyerId: 'buyer-signed' } as OrderEntity;
      await signedGateway.initiatePayment(order, 5000);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sandbox.pawapay.io/v2/checkouts',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-xyz',
            'Content-Type': 'application/json',
            Signature: expect.stringMatching(/^sig-pp=:/),
            'Signature-Input': expect.stringContaining('keyid="test-key-id"'),
            'Signature-Date': expect.any(String),
            'Content-Digest': expect.stringMatching(/^sha-512=:/),
          }),
        }),
      );
    });
  });

  describe('confirmPayment', () => {
    it('should return success true when status is COMPLETED', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'FOUND',
          data: {
            checkoutId: 'ch_123',
            status: 'COMPLETED',
          },
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const result = await gateway.confirmPayment('ch_123');
      expect(result.success).toBe(true);
      expect(result.gatewayRef).toBe('ch_123');
    });

    it('should return success false with pending true when status is PROCESSING', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'FOUND',
          data: {
            checkoutId: 'ch_123',
            status: 'PROCESSING',
          },
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const result = await gateway.confirmPayment('ch_123');
      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
    });

    it('should return success false when status is FAILED', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'FOUND',
          data: {
            checkoutId: 'ch_123',
            status: 'FAILED',
          },
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const result = await gateway.confirmPayment('ch_123');
      expect(result.success).toBe(false);
      expect(result.pending).toBe(false);
    });

    it('should return success false when token is not defined', async () => {
      configService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'PAWAPAY_API_TOKEN') return '';
        return def;
      });
      const unconfigGateway = new PawaPayPaymentGateway(configService);

      const result = await unconfigGateway.confirmPayment('ch_123');
      expect(result.success).toBe(false);
      expect(result.metadata?.error).toContain('PAWAPAY_API_TOKEN is missing');
    });
  });

  describe('refundPayment', () => {
    it('should send refund request with UUID and depositId', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      await gateway.refundPayment('dep_123', 1000);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sandbox.pawapay.io/v2/refunds',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"depositId":"dep_123"'),
        }),
      );
    });
  });
});
