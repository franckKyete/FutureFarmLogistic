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
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface DeliveryAddress {
  id?: string | undefined;
  recipientName?: string | undefined;
  phoneNumber?: string | undefined;
  street?: string | undefined;
  streetAddress?: string | undefined;
  streetAddress2?: string | undefined;
  city: string;
  stateOrProvince?: string | undefined;
  country: string;
  postalCode?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  label?: string | undefined;
}

export interface AddBasketLineDto {
  harvestId: string;
  quantity: number;
}

export interface UpdateBasketLineDto {
  quantity: number;
}

export type PaymentMethodType = 'stripe' | 'mobile_money';

export interface CheckoutDto {
  deliveryAddress: DeliveryAddress;
  notes?: string | undefined;
  paymentMethod?: PaymentMethodType | undefined;
  phoneNumber?: string | undefined;
  mmoProvider?: string | undefined;
  currency?: string | undefined;
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
  harvest?: HarvestDto;
}

export interface BasketDto {
  id: string;
  buyerId: string;
  status: 'ACTIVE' | 'ABANDONED';
  lines: BasketLineDto[];
  createdAt: string;
  updatedAt: string;
}

import { HarvestDto } from './product.types';
import { FarmerProfileDto } from './user.types';
import { OrderAppliedFeeDto } from './fee.types';

export interface OrderPartySummaryDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  companyName?: string | null;
  address?: string | null;
}

export interface OrderDeliverySummaryDto {
  mode: string;
  driverName?: string | null;
  driverPhone?: string | null;
  vehiclePlate?: string | null;
  vehicleType?: string | null;
  status?: string | null;
  eta?: string | null;
}

export interface OrderLineDto {
  id: string;
  orderId: string;
  harvestId: string;
  farmerProfileId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency?: string;
  exchangeRate?: number;
  status: OrderLineStatus;
  rejectionReason: string | null;
  createdAt: string;
  order?: OrderDto;
  harvest?: HarvestDto;
  farmerProfile?: (FarmerProfileDto & { user?: OrderPartySummaryDto }) | null;
}

export interface OrderDto {
  id: string;
  buyerId: string;
  buyer?: OrderPartySummaryDto | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  totalAmountUSD?: number;
  cancellationFee: number;
  fees?: OrderAppliedFeeDto[] | null;
  deliveryAddress: DeliveryAddress;
  notes: string | null;
  cancelledReason: string | null;
  auctionBidId: string | null;
  lines: OrderLineDto[];
  delivery?: OrderDeliverySummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecordDto {
  id: string;
  orderId: string;
  gatewayRef: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  amountUSD?: number;
  status: PaymentStatus;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}

// Port/Interface definitions for pluggable Payment Gateway
export interface PaymentOptions {
  paymentMethod?: PaymentMethodType | string | undefined;
  phoneNumber?: string | undefined;
  mmoProvider?: string | undefined;
}

export interface PaymentInitResult {
  gatewayRef: string;
  paymentUrl?: string | undefined;
  status: PaymentStatus;
  metadata?: any;
}

export interface PaymentConfirmResult {
  success: boolean;
  gatewayRef: string;
  pending?: boolean | undefined;
  metadata?: any;
}
