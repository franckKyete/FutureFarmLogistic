import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { DeliveryRunEntity } from './delivery-run.entity';

const numericTransformer = {
  to: (v: number | null): string | null =>
    v === null || v === undefined ? null : v.toString(),
  from: (v: string | null): number | null =>
    v === null || v === undefined ? null : parseFloat(v),
};

/**
 * Append-only GPS ping log for driver positions.
 * Rows are never updated — each ping creates a new row.
 */
@Entity('driver_locations')
export class DriverLocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity;

  @Index()
  @Column({ name: 'run_id', type: 'uuid', nullable: true })
  runId: string | null;

  @ManyToOne(() => DeliveryRunEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'run_id' })
  run: DeliveryRunEntity | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    transformer: numericTransformer,
  })
  lat: number;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    transformer: numericTransformer,
  })
  lon: number;

  /** Compass bearing in degrees (0–360), nullable */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  heading: number | null;

  @Column({
    name: 'speed_kmh',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  speedKmh: number | null;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;
}
