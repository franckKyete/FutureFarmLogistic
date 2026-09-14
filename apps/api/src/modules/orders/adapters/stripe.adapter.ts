import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEntity } from '../entities/order.entity';
import type { PaymentGatewayPort } from '../interfaces/payment-gateway.port';
import { PaymentInitResult, PaymentConfirmResult, PaymentStatus, PaymentOptions } from '@futurefarm/types';
import Stripe from 'stripe';

@Injectable()
export class StripePaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(StripePaymentGateway.name);
  private readonly stripe: Stripe;
  private readonly currency: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not defined. Stripe operations will fail.');
    }
    // Stripe is optional in local development. Keep the provider constructible
    // when PAYMENT_PROVIDER=mock; real Stripe calls still require a real key.
    this.stripe = new Stripe(secretKey || 'sk_test_local_placeholder');
    this.currency = this.configService.get<string>('STRIPE_CURRENCY', 'usd');
    
    // Default success/cancel URLs pointing to local web app if not configured
    const defaultOrigin = this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3001').split(',')[0] || 'http://localhost:3001';
    this.successUrl = this.configService.get<string>('STRIPE_SUCCESS_URL', `${defaultOrigin}/orders`);
    this.cancelUrl = this.configService.get<string>('STRIPE_CANCEL_URL', `${defaultOrigin}/checkout`);
  }

  async initiatePayment(
    order: OrderEntity,
    amount: number,
    _options?: PaymentOptions,
  ): Promise<PaymentInitResult> {
    const paymentCurrency = (order.currency || this.currency || 'USD').toLowerCase();
    this.logger.log(`Initiating Stripe payment of ${amount} ${paymentCurrency.toUpperCase()} for order ${order.id}`);

    try {
      // Smallest currency unit (cents for USD/EUR, whole unit for zero-decimal currencies like XOF/XAF/RWF/UGX)
      const zeroDecimalCurrencies = ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof'];
      const isZeroDecimal = zeroDecimalCurrencies.includes(paymentCurrency);
      const unitAmount = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: paymentCurrency,
              product_data: {
                name: `FutureFarm Order #${order.id.slice(0, 8)}`,
                description: `Payment for crop harvests`,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
        cancel_url: this.cancelUrl,
        client_reference_id: order.id,
      });

      const result: PaymentInitResult = {
        gatewayRef: session.id,
        status: PaymentStatus.PENDING,
        metadata: {
          provider: 'stripe',
          stripeSessionId: session.id,
          paymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
        },
      };
      if (session.url) {
        result.paymentUrl = session.url;
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Stripe initiation failed: ${errMsg}`, errStack);
      throw error;
    }
  }

  async confirmPayment(paymentRef: string): Promise<PaymentConfirmResult> {
    this.logger.log(`Confirming Stripe payment for reference ${paymentRef}`);

    try {
      // 1. PaymentIntent flow (e.g. auction won off-session charge)
      if (paymentRef.startsWith('pi_')) {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentRef);
        const isPaid = paymentIntent.status === 'succeeded';
        return {
          success: isPaid,
          pending: paymentIntent.status === 'processing' || paymentIntent.status === 'requires_action',
          gatewayRef: paymentRef,
          metadata: {
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            amountReceived: paymentIntent.amount_received,
          },
        };
      }

      // 2. Checkout Session flow (default marketplace cart checkout)
      let session: Stripe.Checkout.Session | null = null;
      try {
        session = await this.stripe.checkout.sessions.retrieve(paymentRef);
      } catch (sessionErr: any) {
        // Fallback: Check if paymentRef is a PaymentIntent if not starting with pi_
        try {
          const pi = await this.stripe.paymentIntents.retrieve(paymentRef);
          if (pi) {
            return {
              success: pi.status === 'succeeded',
              pending: pi.status === 'processing' || pi.status === 'requires_action',
              gatewayRef: paymentRef,
              metadata: {
                paymentIntentId: pi.id,
                status: pi.status,
              },
            };
          }
        } catch {
          // Re-throw original sessionErr if fallback fails
          throw sessionErr;
        }
      }

      if (session) {
        const isPaid = session.payment_status === 'paid';

        const result: PaymentConfirmResult = {
          success: isPaid,
          gatewayRef: paymentRef,
          metadata: {
            paymentStatus: session.payment_status,
            status: session.status,
            paymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
          },
        };
        return result;
      }

      throw new Error(`Unable to retrieve Stripe session or payment intent for ${paymentRef}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Stripe confirmation failed: ${errMsg}`, errStack);
      return {
        success: false,
        gatewayRef: paymentRef,
        metadata: { error: errMsg },
      };
    }
  }

  async refundPayment(paymentRef: string, amount: number): Promise<void> {
    this.logger.log(`Refunding Stripe payment ${paymentRef} with amount ${amount} ${this.currency}`);

    try {
      let paymentIntentId: string | undefined;

      if (paymentRef.startsWith('pi_')) {
        paymentIntentId = paymentRef;
      } else {
        const session = await this.stripe.checkout.sessions.retrieve(paymentRef);
        paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent as any)?.id;
      }

      if (!paymentIntentId) {
        throw new Error('No PaymentIntent associated with payment reference to refund.');
      }

      await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(amount * 100),
      });

      this.logger.log(`Successfully refunded ${amount} for reference ${paymentRef}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Stripe refund failed: ${errMsg}`, errStack);
      throw error;
    }
  }

  constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  async createCustomer(params: {
    email: string;
    name?: string;
    userId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const createParams: Stripe.CustomerCreateParams = {
      email: params.email,
    };
    if (params.name) {
      createParams.name = params.name;
    }
    if (params.metadata || params.userId) {
      createParams.metadata = {
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.metadata || {}),
      };
    }
    return this.stripe.customers.create(createParams);
  }

  async createSetupIntent(
    customerId: string,
  ): Promise<{ clientSecret: string; customerId: string }> {
    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    if (!setupIntent.client_secret) {
      throw new BadRequestException('Failed to create Stripe SetupIntent client secret');
    }

    return {
      clientSecret: setupIntent.client_secret,
      customerId,
    };
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<{
    id: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  }> {
    // Attach payment method to customer
    const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method on the customer invoice settings
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      id: paymentMethod.id,
      brand: paymentMethod.card?.brand || null,
      last4: paymentMethod.card?.last4 || null,
      expMonth: paymentMethod.card?.exp_month || null,
      expYear: paymentMethod.card?.exp_year || null,
    };
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async createSetupCheckoutSession(params: {
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    userId?: string;
    metadata?: Record<string, string>;
  }): Promise<{ sessionId: string; sessionUrl: string }> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'setup',
      customer: params.customerId,
      payment_method_types: ['card'],
      success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}setup_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId || '',
        purpose: 'save_card',
        ...(params.metadata || {}),
      },
    };

    if (params.userId) {
      sessionParams.client_reference_id = params.userId;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe Checkout Setup session URL');
    }

    return {
      sessionId: session.id,
      sessionUrl: session.url,
    };
  }

  async confirmSetupCheckoutSession(sessionId: string): Promise<{
    paymentMethodId: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    customerId: string;
    userId?: string;
  }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent', 'setup_intent.payment_method'],
    });

    const setupIntent = session.setup_intent as Stripe.SetupIntent;
    if (!setupIntent) {
      throw new BadRequestException('No SetupIntent associated with this checkout session');
    }

    const paymentMethod = setupIntent.payment_method as Stripe.PaymentMethod;
    if (!paymentMethod) {
      throw new BadRequestException('No PaymentMethod attached to SetupIntent');
    }

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (customerId) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });
    }

    const result: {
      paymentMethodId: string;
      brand: string | null;
      last4: string | null;
      expMonth: number | null;
      expYear: number | null;
      customerId: string;
      userId?: string;
    } = {
      paymentMethodId: paymentMethod.id,
      brand: paymentMethod.card?.brand || null,
      last4: paymentMethod.card?.last4 || null,
      expMonth: paymentMethod.card?.exp_month || null,
      expYear: paymentMethod.card?.exp_year || null,
      customerId: customerId || '',
    };

    const resolvedUserId = session.client_reference_id || session.metadata?.userId;
    if (resolvedUserId) {
      result.userId = resolvedUserId;
    }

    return result;
  }

  async chargeSavedCard(params: {
    customerId: string;
    paymentMethodId: string;
    amount: number;
    currency: string;
    description?: string;
    orderId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    const { customerId, paymentMethodId, amount, currency, description, orderId, metadata } = params;
    const paymentCurrency = (currency || this.currency || 'USD').toLowerCase();

    const zeroDecimalCurrencies = [
      'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof',
    ];
    const unitMultiplier = zeroDecimalCurrencies.includes(paymentCurrency) ? 1 : 100;
    const stripeAmount = Math.round(amount * unitMultiplier);

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: stripeAmount,
      currency: paymentCurrency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    };

    if (description) {
      intentParams.description = description;
    }
    if (orderId || metadata) {
      intentParams.metadata = {
        ...(orderId ? { orderId } : {}),
        ...(metadata || {}),
      };
    }

    return this.stripe.paymentIntents.create(intentParams);
  }
}
