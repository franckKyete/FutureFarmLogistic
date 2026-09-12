import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEntity } from '../entities/order.entity';
import { PaymentGatewayPort, MockPaymentGateway } from '../interfaces/payment-gateway.port';
import { StripePaymentGateway } from './stripe.adapter';
import { PawaPayPaymentGateway } from './pawapay.adapter';
import {
  PaymentInitResult,
  PaymentConfirmResult,
  PaymentOptions,
} from '@futurefarm/types';

@Injectable()
export class CompositePaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(CompositePaymentGateway.name);

  constructor(
    private readonly stripeGateway: StripePaymentGateway,
    private readonly pawapayGateway: PawaPayPaymentGateway,
    private readonly mockGateway: MockPaymentGateway,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(
    order: OrderEntity,
    amount: number,
    options?: PaymentOptions,
  ): Promise<PaymentInitResult> {
    const method = options?.paymentMethod;
    this.logger.log(`Routing payment for order ${order.id} with method: ${method || 'default'}`);

    if (method === 'mobile_money' || method === 'pawapay') {
      return this.pawapayGateway.initiatePayment(order, amount, options);
    }

    if (method === 'stripe' || method === 'card') {
      return this.stripeGateway.initiatePayment(order, amount, options);
    }

    // Default based on environment config
    const defaultProvider = this.configService.get<string>('PAYMENT_PROVIDER', 'mock');
    if (defaultProvider === 'stripe') {
      return this.stripeGateway.initiatePayment(order, amount, options);
    }
    if (defaultProvider === 'pawapay') {
      return this.pawapayGateway.initiatePayment(order, amount, options);
    }

    return this.mockGateway.initiatePayment(order, amount, options);
  }

  private isStripeReference(ref: string): boolean {
    return (
      ref.startsWith('cs_') ||
      ref.startsWith('pi_') ||
      ref.startsWith('seti_') ||
      ref.startsWith('ch_') ||
      ref.startsWith('sub_') ||
      ref.startsWith('evt_')
    );
  }

  async confirmPayment(paymentRef: string): Promise<PaymentConfirmResult> {
    this.logger.log(`Confirming payment for reference: ${paymentRef}`);

    if (this.isStripeReference(paymentRef)) {
      return this.stripeGateway.confirmPayment(paymentRef);
    }

    if (paymentRef.startsWith('mock-')) {
      return this.mockGateway.confirmPayment(paymentRef);
    }

    // Attempt confirmation via PawaPay first
    const pawapayResult = await this.pawapayGateway.confirmPayment(paymentRef);
    if (pawapayResult.success) {
      return pawapayResult;
    }

    // Fallback to Stripe if not found or failed on PawaPay
    try {
      const stripeResult = await this.stripeGateway.confirmPayment(paymentRef);
      if (stripeResult.success) {
        return stripeResult;
      }
    } catch {
      // Ignore stripe error and return original pawapay result
    }

    return pawapayResult;
  }

  async refundPayment(paymentRef: string, amount: number): Promise<void> {
    this.logger.log(`Refunding payment for reference: ${paymentRef}`);

    if (this.isStripeReference(paymentRef)) {
      return this.stripeGateway.refundPayment(paymentRef, amount);
    }

    if (paymentRef.startsWith('mock-')) {
      return this.mockGateway.refundPayment(paymentRef, amount);
    }

    try {
      await this.pawapayGateway.refundPayment(paymentRef, amount);
    } catch {
      await this.stripeGateway.refundPayment(paymentRef, amount);
    }
  }
}
