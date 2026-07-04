// =============================================================================
// Purchase & Order Shared Types
// =============================================================================

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum OrderLineStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export interface DeliveryAddress {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface AddBasketLineDto {
  harvestId: string;
  quantity: number;
}

export interface UpdateBasketLineDto {
  quantity: number;
}

export interface CheckoutDto {
  deliveryAddress: DeliveryAddress;
  notes?: string;
}

export interface RejectOrderLineDto {
  reason: string;
}

export interface BasketLineDto {
  id: string;
  basketId: string;
  harvestId: string;
  quantity: number;
  createdAt: string;
}

export interface BasketDto {
  id: string;
  buyerId: string;
  status: 'ACTIVE' | 'ABANDONED';
  lines: BasketLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineDto {
  id: string;
  orderId: string;
  harvestId: string;
  farmerProfileId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: OrderLineStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  buyerId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  cancellationFee: number;
  deliveryAddress: DeliveryAddress;
  notes: string | null;
  cancelledReason: string | null;
  auctionBidId: string | null;
  lines: OrderLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecordDto {
  id: string;
  orderId: string;
  gatewayRef: string;
  amount: number;
  status: PaymentStatus;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}

// Port/Interface definitions for pluggable Payment Gateway
export interface PaymentInitResult {
  gatewayRef: string;
  paymentUrl?: string;
  status: PaymentStatus;
  metadata?: any;
}

export interface PaymentConfirmResult {
  success: boolean;
  gatewayRef: string;
  metadata?: any;
}
