import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderLineStatus } from '@futurefarm/types';
import { OrderEntity } from './order.entity';
import { HarvestEntity } from '../../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../../users/entities/farmer-profile.entity';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('order_lines')
export class OrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, (order) => order.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

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
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: OrderLineStatus,
    default: OrderLineStatus.PENDING,
  })
  status: OrderLineStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
