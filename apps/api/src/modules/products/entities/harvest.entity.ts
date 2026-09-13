import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  HarvestStatus,
  HarvestUnit,
  type PriceDecayConfig,
} from '@futurefarm/types';
import { ProductEntity } from './product.entity';
import { FarmerProfileEntity } from '../../users/entities/farmer-profile.entity';
import { ParcelEntity } from '../../users/entities/parcel.entity';
import { UserEntity } from '../../users/entities/user.entity';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('harvests')
export class HarvestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => ProductEntity, (product) => product.harvests, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Index()
  @Column({ name: 'farmer_profile_id' })
  farmerProfileId: string;

  @ManyToOne(() => FarmerProfileEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'farmer_profile_id' })
  farmerProfile: FarmerProfileEntity;

  @Index()
  @Column({ name: 'parcel_id', type: 'uuid', nullable: true })
  parcelId: string | null;

  @ManyToOne(() => ParcelEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parcel_id' })
  parcel: ParcelEntity | null;

  @Column({ name: 'harvest_date', type: 'date' })
  harvestDate: Date;

  @Column({ name: 'expiration_date', type: 'date' })
  expirationDate: Date;

  @Column({
    name: 'quantity_in_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  quantityInStock: number;

  @Column({
    name: 'stock_marge',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  stockMarge: number;

  @Column({
    name: 'price_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  pricePerUnit: number;

  @Column({ type: 'varchar', length: 10, default: 'CDF' })
  currency: string;

  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 16,
    scale: 6,
    default: 2300.0,
    transformer: numericTransformer,
  })
  exchangeRate: number;

  @Column({
    name: 'price_per_unit_usd',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  pricePerUnitUSD: number | null;

  @Column({
    type: 'enum',
    enum: HarvestUnit,
  })
  unit: HarvestUnit;

  @Column({ name: 'farming_methods', type: 'text', nullable: true })
  farmingMethods: string | null;

  @Column('simple-array', { nullable: true })
  photoUrls: string[];

  @Column({
    type: 'enum',
    enum: HarvestStatus,
    default: HarvestStatus.PENDING_APPROVAL,
  })
  status: HarvestStatus;

  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  qualityScore: number | null;

  @Column({ name: 'price_decay_config', type: 'jsonb', nullable: true })
  priceDecayConfig: PriceDecayConfig | null;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: UserEntity | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
