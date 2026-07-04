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
import { VehicleType } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';

const numericTransformer = {
  to: (v: number | null): string | null =>
    v === null || v === undefined ? null : v.toString(),
  from: (v: string | null): number | null =>
    v === null || v === undefined ? null : parseFloat(v),
};

@Entity('vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'registration_plate', type: 'varchar', length: 50 })
  registrationPlate: string;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column({
    name: 'capacity_kg',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  capacityKg: number;

  @Column({
    name: 'capacity_m3',
    type: 'decimal',
    precision: 10,
    scale: 3,
    transformer: numericTransformer,
  })
  capacityM3: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Index()
  @Column({ name: 'current_driver_id', type: 'uuid', nullable: true })
  currentDriverId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'current_driver_id' })
  currentDriver: UserEntity | null;

  @Column({
    name: 'last_known_lat',
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  lastKnownLat: number | null;

  @Column({
    name: 'last_known_lon',
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  lastKnownLon: number | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
