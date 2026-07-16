import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEntity } from '../entities/order.entity';
import { PaymentGatewayPort } from '../interfaces/payment-gateway.port';
import { PaymentInitResult, PaymentConfirmResult, PaymentStatus } from '@futurefarm/types';
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
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-02-18-or-whatever' as any, // Using the library default
    });
    this.currency = this.configService.get<string>('STRIPE_CURRENCY', 'usd');
    
    // Default success/cancel URLs pointing to local web app if not configured
    const defaultOrigin = this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3001').split(',')[0] || 'http://localhost:3001';
    this.successUrl = this.configService.get<string>('STRIPE_SUCCESS_URL', `${defaultOrigin}/orders`);
    this.cancelUrl = this.configService.get<string>('STRIPE_CANCEL_URL', `${defaultOrigin}/checkout`);
  }

  async initiatePayment(order: OrderEntity, amount: number): Promise<PaymentInitResult> {
    this.logger.log(`Initiating Stripe payment of ${amount} ${this.currency} for order ${order.id}`);

    try {
      // Amount in cents/smallest currency unit
      const unitAmount = Math.round(amount * 100);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: this.currency,
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
    this.logger.log(`Confirming Stripe payment for session ${paymentRef}`);

    try {
      const session = await this.stripe.checkout.sessions.retrieve(paymentRef);
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
      const session = await this.stripe.checkout.sessions.retrieve(paymentRef);
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as any)?.id;

      if (!paymentIntentId) {
        throw new Error('No PaymentIntent associated with checkout session to refund.');
      }

      await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(amount * 100),
      });

      this.logger.log(`Successfully refunded ${amount} for session ${paymentRef}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Stripe refund failed: ${errMsg}`, errStack);
      throw error;
    }
  }
}
