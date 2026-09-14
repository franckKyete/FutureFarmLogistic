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
import { PickupCondition, PickupReportStatus } from '@futurefarm/types';
import { DeliveryStopEntity } from './delivery-stop.entity';
import { OrderLineEntity } from '../../orders/entities/order-line.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('pickup_reports')
export class PickupReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'stop_id', type: 'uuid' })
  stopId: string;

  @ManyToOne(() => DeliveryStopEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stop_id' })
  stop: DeliveryStopEntity;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity | null;

  @Index()
  @Column({ name: 'order_line_id', type: 'uuid' })
  orderLineId: string;

  @ManyToOne(() => OrderLineEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_line_id' })
  orderLine: OrderLineEntity;

  @Column({
    type: 'enum',
    enum: PickupReportStatus,
    default: PickupReportStatus.PENDING,
  })
  status: PickupReportStatus;

  @Column({ name: 'quantity_verified', type: 'boolean', nullable: true })
  quantityVerified: boolean | null;

  @Column({
    name: 'condition_ok',
    type: 'enum',
    enum: PickupCondition,
    nullable: true,
  })
  conditionOk: PickupCondition | null;

  @Column({ name: 'packaging_intact', type: 'boolean', nullable: true })
  packagingIntact: boolean | null;

  @Column({
    name: 'weight_actual_kg',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => (value === null || value === undefined ? null : value.toString()),
      from: (value: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
    },
  })
  weightActualKg: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
