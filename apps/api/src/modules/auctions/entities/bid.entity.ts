import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BidStatus } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';
import { AuctionEntity, numericTransformer } from './auction.entity';

@Entity('bids')
export class BidEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'auction_id', type: 'uuid' })
  auctionId: string;

  @ManyToOne(() => AuctionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'auction_id' })
  auction: AuctionEntity;

  @Index()
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: UserEntity;

  @Column({
    name: 'price_at_bid',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  priceAtBid: number;

  @Column({
    name: 'quantity_won',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  quantityWon: number;

  @Column({
    type: 'enum',
    enum: BidStatus,
    default: BidStatus.ACCEPTED,
  })
  status: BidStatus;

  @Index()
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
