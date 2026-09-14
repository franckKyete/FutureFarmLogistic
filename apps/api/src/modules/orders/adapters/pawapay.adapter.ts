import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEntity } from '../entities/order.entity';
import type { PaymentGatewayPort } from '../interfaces/payment-gateway.port';
import {
  PaymentInitResult,
  PaymentConfirmResult,
  PaymentStatus,
  PaymentOptions,
} from '@futurefarm/types';
import { createHash, createPrivateKey, createSign, randomUUID } from 'crypto';
import { httpbis } from 'http-message-signatures';

@Injectable()
export class PawaPayPaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(PawaPayPaymentGateway.name);
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly currency: string;
  private readonly country: string;
  private readonly returnUrl: string;
  private readonly privateKeyPem: string | undefined;
  private readonly keyId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('PAWAPAY_API_TOKEN', '');
    this.baseUrl = this.configService
      .get<string>('PAWAPAY_BASE_URL', 'https://api.sandbox.pawapay.io')
      .replace(/\/+$/, '')
      .replace(/\/v2$/, '');
    this.currency = this.configService.get<string>('PAWAPAY_CURRENCY', 'XOF');
    this.country = this.configService.get<string>('PAWAPAY_COUNTRY', 'SEN');

    const defaultOrigin =
      this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3001').split(',')[0] ||
      'http://localhost:3001';
    this.returnUrl = this.configService.get<string>('PAWAPAY_RETURN_URL', `${defaultOrigin}/orders`);

    const rawKey = this.configService.get<string>('PAWAPAY_PRIVATE_KEY');
    this.privateKeyPem = rawKey ? rawKey.replace(/\\n/g, '\n').trim() : undefined;
    this.keyId = this.configService.get<string>('PAWAPAY_KEY_ID', '1');

    if (!this.apiToken) {
      this.logger.warn(
        'PAWAPAY_API_TOKEN is not defined. PawaPay operations will be rejected until configured.',
      );
    }
  }

  private async buildSignedHeaders(
    method: 'POST' | 'GET',
    url: string,
    body?: string,
  ): Promise<Record<string, string>> {
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };

    if (!this.privateKeyPem || !body) {
      return baseHeaders;
    }

    try {
      const privateKey = createPrivateKey(this.privateKeyPem);
      const contentDigest = `sha-512=:${createHash('sha512').update(body, 'utf8').digest('base64')}:`;
      const signatureDate = new Date().toISOString();
      const contentLength = Buffer.byteLength(body, 'utf8').toString();

      const signedRequest = await httpbis.signMessage(
        {
          key: {
            id: this.keyId,
            alg: 'ecdsa-p256-sha256',
            async sign(data: Buffer | Uint8Array) {
              return createSign('SHA256').update(data).sign(privateKey);
            },
          },
          name: 'sig-pp',
          fields: [
            '@method',
            '@authority',
            '@path',
            'signature-date',
            'content-digest',
            'content-type',
            'content-length',
          ],
        },
        {
          method,
          url,
          headers: {
            ...baseHeaders,
            'Signature-Date': signatureDate,
            'Content-Digest': contentDigest,
            'Content-Length': contentLength,
          },
          body,
        },
      );

      return {
        ...signedRequest.headers,
        'Accept-Signature': 'rsa-pss-sha512,ecdsa-p256-sha256,rsa-v1_5-sha256,ecdsa-p384-sha384',
        'Accept-Digest': 'sha-256,sha-512',
      };
    } catch (err) {
      this.logger.error(
        `Failed to sign request with RFC-9421: ${err instanceof Error ? err.message : String(err)}`,
      );
      return baseHeaders;
    }
  }

  async initiatePayment(
    order: OrderEntity,
    amount: number,
    options?: PaymentOptions,
  ): Promise<PaymentInitResult> {
    const paymentCurrency = (order.currency || this.currency || 'CDF').toUpperCase();
    let resolvedCountry = (order.deliveryAddress?.country || this.country || 'COD').toUpperCase();

    // Map currency to supported PawaPay country if needed
    if (paymentCurrency === 'CDF') {
      resolvedCountry = 'COD';
    } else if (paymentCurrency === 'XOF') {
      const xofCountries = ['SEN', 'CIV', 'BEN', 'BFA', 'TGO', 'MLI', 'NER'];
      if (!xofCountries.includes(resolvedCountry)) {
        resolvedCountry = 'SEN';
      }
    } else if (paymentCurrency === 'XAF') {
      const xafCountries = ['CMR', 'COG', 'GAB', 'TCD', 'GNQ', 'CAF'];
      if (!xafCountries.includes(resolvedCountry)) {
        resolvedCountry = 'CMR';
      }
    } else if (paymentCurrency === 'KES') {
      resolvedCountry = 'KEN';
    } else if (paymentCurrency === 'GHS') {
      resolvedCountry = 'GHA';
    } else if (paymentCurrency === 'RWF') {
      resolvedCountry = 'RWA';
    } else if (paymentCurrency === 'UGX') {
      resolvedCountry = 'UGA';
    } else if (paymentCurrency === 'ZMW') {
      resolvedCountry = 'ZMB';
    } else if (paymentCurrency === 'USD') {
      resolvedCountry = 'COD';
    }

    this.logger.log(
      `Initiating PawaPay payment of ${amount} ${paymentCurrency} for country ${resolvedCountry} (order ${order.id})`,
    );

    if (!this.apiToken) {
      this.logger.error(
        `Cannot initiate PawaPay payment for order ${order.id}: PAWAPAY_API_TOKEN is not configured.`,
      );
      throw new BadRequestException(
        'PawaPay API token is not configured. Please set PAWAPAY_API_TOKEN in your environment (.env).',
      );
    }

    const checkoutId = randomUUID();
    const integerAmount = Math.ceil(amount);
    const formattedAmount = integerAmount.toString();

    // PawaPay strictly requires HTTPS for returnUrl
    const rawReturnUrl =
      options?.returnUrl ||
      (options?.clientOrigin ? `${options.clientOrigin}/orders` : this.returnUrl);
    const baseReturnUrl = rawReturnUrl.startsWith('http://')
      ? rawReturnUrl.replace('http://', 'https://')
      : rawReturnUrl;
    const separator = baseReturnUrl.includes('?') ? '&' : '?';
    const returnUrl = `${baseReturnUrl}${separator}provider=pawapay&checkoutId=${checkoutId}&orderId=${order.id}`;

    try {
      const payload: Record<string, any> = {
        checkoutId,
        returnUrl,
        returnMethod: 'INSTANT',
        defaultLanguage: 'fr',
        countries: [resolvedCountry],
        expiresAfter: 60,
        amounts: [
          {
            country: resolvedCountry,
            currency: paymentCurrency,
            amount: formattedAmount,
          },
        ],
        reason: {
          fr: 'Commande FutureFarm',
        },
        metadata: [
          { orderId: order.id },
          { buyerId: order.buyerId },
          { originalAmount: amount.toString() },
          { integerChargedAmount: formattedAmount },
        ],
      };

      if (options?.phoneNumber) {
        const cleanPhone = options.phoneNumber.replace(/[\s+]/g, '');
        payload.payer = {
          type: 'MMO',
          accountDetails: {
            phoneNumber: cleanPhone,
            ...(options.mmoProvider ? { provider: options.mmoProvider } : {}),
            allowCustomerToOverride: true,
          },
        };
      }

      const body = JSON.stringify(payload);
      const url = `${this.baseUrl}/v2/checkouts`;
      const headers = await this.buildSignedHeaders('POST', url, body);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `PawaPay checkout initiation HTTP error ${response.status}: ${errorText}`,
        );
        throw new BadRequestException(`PawaPay initiation failed: ${errorText}`);
      }

      const data = (await response.json()) as {
        checkoutId: string;
        redirectUrl?: string;
        checkoutCode?: string;
        status: string;
      };

      if (!data.redirectUrl) {
        this.logger.error(`PawaPay did not return a redirectUrl: ${JSON.stringify(data)}`);
        throw new BadRequestException('PawaPay did not return a redirectUrl for hosted checkout');
      }

      return {
        gatewayRef: checkoutId,
        paymentUrl: data.redirectUrl,
        status: PaymentStatus.PENDING,
        metadata: {
          provider: 'pawapay',
          checkoutId: data.checkoutId || checkoutId,
          checkoutCode: data.checkoutCode,
          status: data.status,
          redirectUrl: data.redirectUrl,
          chargedAmount: integerAmount,
          originalAmount: amount,
          roundedDiff: integerAmount - amount,
        },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`PawaPay checkout failed: ${errMsg}`, errStack);
      throw error;
    }
  }

  async confirmPayment(paymentRef: string): Promise<PaymentConfirmResult> {
    this.logger.log(`Confirming PawaPay payment for reference ${paymentRef}`);

    if (!this.apiToken) {
      this.logger.error('Cannot confirm PawaPay payment: PAWAPAY_API_TOKEN is not configured');
      return {
        success: false,
        gatewayRef: paymentRef,
        metadata: {
          provider: 'pawapay',
          error: 'PAWAPAY_API_TOKEN is missing. PawaPay is not configured.',
        },
      };
    }

    try {
      // Check checkout status endpoint
      const response = await fetch(`${this.baseUrl}/v2/checkouts/${paymentRef}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (response.ok) {
        const resJson = (await response.json()) as {
          status: string;
          data?: {
            checkoutId: string;
            status: string;
            depositStatus?: string;
            deposit?: { status: string; depositId: string };
            checkoutCode?: string;
          };
        };

        const checkoutStatus = resJson.data?.status;
        if (checkoutStatus === 'COMPLETED') {
          return {
            success: true,
            gatewayRef: paymentRef,
            metadata: {
              provider: 'pawapay',
              status: checkoutStatus,
              data: resJson.data,
            },
          };
        }

        if (checkoutStatus === 'WAITING_PAYMENT' || checkoutStatus === 'PROCESSING') {
          return {
            success: false,
            pending: true,
            gatewayRef: paymentRef,
            metadata: {
              provider: 'pawapay',
              status: checkoutStatus,
              data: resJson.data,
            },
          };
        }

        return {
          success: false,
          pending: false,
          gatewayRef: paymentRef,
          metadata: {
            provider: 'pawapay',
            status: checkoutStatus,
            data: resJson.data,
          },
        };
      }

      // Try checking deposits endpoint in case paymentRef was a direct depositId
      const depositResp = await fetch(`${this.baseUrl}/v2/deposits/${paymentRef}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (depositResp.ok) {
        const depositData = (await depositResp.json()) as {
          depositId: string;
          status: string;
        };
        if (depositData.status === 'COMPLETED') {
          return {
            success: true,
            gatewayRef: paymentRef,
            metadata: {
              provider: 'pawapay',
              status: depositData.status,
              deposit: depositData,
            },
          };
        }
        if (depositData.status === 'PROCESSING' || depositData.status === 'ACCEPTED') {
          return {
            success: false,
            pending: true,
            gatewayRef: paymentRef,
            metadata: {
              provider: 'pawapay',
              status: depositData.status,
              deposit: depositData,
            },
          };
        }
        return {
          success: false,
          pending: false,
          gatewayRef: paymentRef,
          metadata: {
            provider: 'pawapay',
            status: depositData.status,
            deposit: depositData,
          },
        };
      }

      const errText = await response.text();
      this.logger.error(`Failed to fetch PawaPay checkout status: ${errText}`);
      return {
        success: false,
        gatewayRef: paymentRef,
        metadata: { provider: 'pawapay', error: errText },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during PawaPay confirmPayment: ${errMsg}`);
      return {
        success: false,
        gatewayRef: paymentRef,
        metadata: { provider: 'pawapay', error: errMsg },
      };
    }
  }

  async refundPayment(paymentRef: string, amount: number): Promise<void> {
    this.logger.log(`Refunding PawaPay payment ${paymentRef} of amount ${amount}`);

    if (!this.apiToken) {
      this.logger.log(`Simulation mode: refund ${paymentRef} recorded`);
      return;
    }

    try {
      const refundId = randomUUID();
      const body = JSON.stringify({
        refundId,
        depositId: paymentRef,
      });
      const url = `${this.baseUrl}/v2/refunds`;
      const headers = await this.buildSignedHeaders('POST', url, body);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`PawaPay refund HTTP error ${response.status}: ${errorText}`);
        throw new BadRequestException(`PawaPay refund failed: ${errorText}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`PawaPay refund error: ${errMsg}`);
      throw error;
    }
  }
}
