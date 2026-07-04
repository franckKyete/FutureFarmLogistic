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
import { DeliveryRunStatus } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';
import { VehicleEntity } from './vehicle.entity';
import { DeliveryStopEntity } from './delivery-stop.entity';

const numericTransformer = {
  to: (v: number | null): string | null =>
    v === null || v === undefined ? null : v.toString(),
  from: (v: string | null): number | null =>
    v === null || v === undefined ? null : parseFloat(v),
};

@Entity('delivery_runs')
export class DeliveryRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity | null;

  @Index()
  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => VehicleEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity | null;

  @Column({
    type: 'enum',
    enum: DeliveryRunStatus,
    default: DeliveryRunStatus.PLANNED,
  })
  status: DeliveryRunStatus;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /**
   * Ordered waypoint sequence returned by OSRM.
   * Format: Array<{ stopId: string; lat: number; lon: number; sequence: number }>
   */
  @Column({ name: 'optimised_route', type: 'jsonb', nullable: true })
  optimisedRoute: object | null;

  @Column({
    name: 'total_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  totalDistanceKm: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => DeliveryStopEntity, (stop) => stop.run, { cascade: true })
  stops: DeliveryStopEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
