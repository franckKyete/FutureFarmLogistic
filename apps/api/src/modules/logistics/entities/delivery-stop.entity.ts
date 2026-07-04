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
import { DeliveryStopType, DeliveryStopStatus, StopAddress } from '@futurefarm/types';
import { DeliveryRunEntity } from './delivery-run.entity';
import { OrderLineEntity } from '../../orders/entities/order-line.entity';
import { InspectionReportEntity } from '../../inspections/entities/inspection-report.entity';

@Entity('delivery_stops')
export class DeliveryStopEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => DeliveryRunEntity, (run) => run.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: DeliveryRunEntity;

  @Index()
  @Column({ name: 'order_line_id', type: 'uuid' })
  orderLineId: string;

  @ManyToOne(() => OrderLineEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_line_id' })
  orderLine: OrderLineEntity;

  @Column({ type: 'enum', enum: DeliveryStopType })
  type: DeliveryStopType;

  @Column({ type: 'int' })
  sequence: number;

  @Column({
    type: 'enum',
    enum: DeliveryStopStatus,
    default: DeliveryStopStatus.PENDING,
  })
  status: DeliveryStopStatus;

  /**
   * Geocoded address for this stop.
   * Format: { street, city, lat, lon }
   */
  @Column({ type: 'jsonb' })
  address: StopAddress;

  @Column({ name: 'eta', type: 'timestamptz', nullable: true })
  eta: Date | null;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** Cloud storage URL for delivery proof photo */
  @Column({ name: 'proof_photo_url', type: 'varchar', length: 1000, nullable: true })
  proofPhotoUrl: string | null;

  /** AI pickup inspection report (COLLECTION stops only) */
  @Column({ name: 'pickup_report_id', type: 'uuid', nullable: true })
  pickupReportId: string | null;

  @ManyToOne(() => InspectionReportEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pickup_report_id' })
  pickupReport: InspectionReportEntity | null;

  @Column({ name: 'skip_reason', type: 'text', nullable: true })
  skipReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
