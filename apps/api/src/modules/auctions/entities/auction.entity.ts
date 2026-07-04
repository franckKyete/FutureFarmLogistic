import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuctionStatus } from '@futurefarm/types';
import { HarvestEntity } from '../../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../../users/entities/farmer-profile.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { BidEntity } from './bid.entity';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('auctions')
@Index('UQ_harvest_active_auction', ['harvestId'], {
  unique: true,
  where: `"status" IN ('SCHEDULED', 'ACTIVE')`,
})
export class AuctionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'harvest_id', type: 'uuid' })
  harvestId: string;

  @ManyToOne(() => HarvestEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'harvest_id' })
  harvest: HarvestEntity;

  @Index()
  @Column({ name: 'farmer_profile_id', type: 'uuid' })
  farmerProfileId: string;

  @ManyToOne(() => FarmerProfileEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'farmer_profile_id' })
  farmerProfile: FarmerProfileEntity;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.SCHEDULED,
  })
  status: AuctionStatus;

  @Column({
    name: 'starting_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  startingPrice: number;

  @Column({
    name: 'reserve_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  reservePrice: number;

  @Column({
    name: 'current_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  currentPrice: number;

  @Column({
    name: 'price_decrement_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  priceDecrementAmount: number;

  @Column({ name: 'price_decrement_interval_minutes', type: 'integer' })
  priceDecrementIntervalMinutes: number;

  @Column({ name: 'next_decrement_at', type: 'timestamp' })
  nextDecrementAt: Date;

  @Column({
    name: 'quantity_on_offer',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  quantityOnOffer: number;

  @Column({ name: 'start_at', type: 'timestamp' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamp' })
  endAt: Date;

  @Column({ name: 'sold_at', type: 'timestamp', nullable: true })
  soldAt: Date | null;

  @Column({ name: 'winner_id', type: 'uuid', nullable: true })
  winnerId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: UserEntity | null;

  @Column({ name: 'winning_bid_id', type: 'uuid', nullable: true })
  winningBidId: string | null;

  @OneToOne(() => BidEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'winning_bid_id' })
  winningBid: BidEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
