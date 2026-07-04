import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderStatus, PaymentStatus, DeliveryAddress } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';
import { OrderLineEntity } from './order-line.entity';
import { BidEntity } from '../../auctions/entities/bid.entity';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: UserEntity;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({
    name: 'cancellation_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  cancellationFee: number;

  @Column({
    name: 'delivery_address',
    type: 'jsonb',
  })
  deliveryAddress: DeliveryAddress;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string | null;

  @Column({ name: 'auction_bid_id', type: 'uuid', nullable: true })
  auctionBidId: string | null;

  @ManyToOne(() => BidEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'auction_bid_id' })
  auctionBid: BidEntity | null;

  @OneToMany(() => OrderLineEntity, (line) => line.order, { cascade: true })
  lines: OrderLineEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
