import { OrderEntity } from '../entities/order.entity';
import { PaymentInitResult, PaymentConfirmResult, PaymentStatus } from '@futurefarm/types';

export const PAYMENT_GATEWAY_PORT = 'PaymentGatewayPort';

export interface PaymentGatewayPort {
  initiatePayment(order: OrderEntity, amount: number): Promise<PaymentInitResult>;
  confirmPayment(paymentRef: string): Promise<PaymentConfirmResult>;
  refundPayment(paymentRef: string, amount: number): Promise<void>;
}

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockPaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(MockPaymentGateway.name);

  async initiatePayment(order: OrderEntity, amount: number): Promise<PaymentInitResult> {
    this.logger.log(`Initiating mock payment of ${amount} for order ${order.id}`);
    const gatewayRef = `mock-ref-${order.id}-${Date.now()}`;
    return {
      gatewayRef,
      paymentUrl: `https://mock-gateway.com/pay/${gatewayRef}`,
      status: PaymentStatus.PENDING,
      metadata: { initiatedAt: new Date().toISOString() },
    };
  }

  async confirmPayment(paymentRef: string): Promise<PaymentConfirmResult> {
    this.logger.log(`Confirming mock payment for ref ${paymentRef}`);
    return {
      success: true,
      gatewayRef: paymentRef,
      metadata: { confirmedAt: new Date().toISOString() },
    };
  }

  async refundPayment(paymentRef: string, amount: number): Promise<void> {
    this.logger.log(`Refunding mock payment ${paymentRef} of amount ${amount}`);
  }
}
